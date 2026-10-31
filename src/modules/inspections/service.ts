import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import { privateStorage } from "@/modules/documents/private-storage";
import { inspectionEventSchema } from "@/modules/inspections/schema";
import { assertOperationalPermission, resolveOperationalScope, type OperationalActor } from "@/server/auth-guards";

type PreparedFile = {
  id: string;
  key: string;
  name: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  size: number;
  sha256: string;
  bytes: Uint8Array;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function detectImageType(bytes: Uint8Array): PreparedFile["mimeType"] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  if (
    bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}

async function prepareFiles(files: File[]): Promise<PreparedFile[]> {
  if (files.length > 2) throw new Error("حداکثر دو تصویر برای هر بازرسی پذیرفته می‌شود.");
  const prepared: PreparedFile[] = [];
  for (const file of files) {
    if (file.size < 1 || file.size > 5 * 1024 * 1024) throw new Error("حجم هر تصویر باید حداکثر ۵ مگابایت باشد.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = detectImageType(bytes);
    if (!mimeType) throw new Error("فقط تصویر معتبر JPEG، PNG یا WebP پذیرفته می‌شود.");
    const safeName = file.name.replace(/[\x00-\x1f\x7f]/g, "").split(/[\\/]/).pop()?.slice(0, 120) || "evidence";
    prepared.push({
      id: randomUUID(),
      key: randomUUID(),
      name: safeName,
      mimeType,
      size: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes,
    });
  }
  return prepared;
}

async function recordAudit(client: PoolClient, values: {
  actorId: string; organizationId: string; branchId: string; action: string;
  entityType: string; entityId: string; metadata?: Record<string, unknown>;
}): Promise<void> {
  await client.query(
    `INSERT INTO audit_events (id, actor_user_id, organization_id, branch_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [randomUUID(), values.actorId, values.organizationId, values.branchId, values.action, values.entityType, values.entityId, JSON.stringify(values.metadata ?? {})],
  );
}

export async function submitInspection(
  actor: OperationalActor,
  eventInput: unknown,
  files: File[] = [],
  retryCount = 0,
): Promise<{ status: "synced" | "conflict"; inspectionId?: string; duplicate?: boolean }> {
  const event = inspectionEventSchema.parse(eventInput);
  const scope = await resolveOperationalScope(actor, event.organizationId, event.branchId);
  if (!scope) throw new Error("این تجهیز در محدودهٔ دسترسی شما نیست.");
  await assertOperationalPermission(scope, "inspection.create");

  const preparedFiles = await prepareFiles(files);
  const answerPayload = [...event.answers].sort((a, b) => a.questionId.localeCompare(b.questionId));
  const payloadHash = createHash("sha256")
    .update(canonical({ ...event, answers: answerPayload, files: preparedFiles.map(({ sha256, size, mimeType }) => ({ sha256, size, mimeType })) }))
    .digest("hex");

  const client = await pool.connect();
  const storedKeys: string[] = [];
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ payload_sha256: string; result_inspection_id: string | null }>(
      `SELECT payload_sha256, result_inspection_id FROM offline_sync_events
        WHERE organization_id = $1 AND client_event_id = $2 FOR UPDATE`,
      [scope.organizationId, event.clientEventId],
    );
    if (existing.rowCount) {
      const previous = existing.rows[0]!;
      await client.query("ROLLBACK");
      return previous.payload_sha256 === payloadHash && previous.result_inspection_id
        ? { status: "synced", inspectionId: previous.result_inspection_id, duplicate: true }
        : { status: "conflict" };
    }

    const equipment = await client.query<{ id: string }>(
      `SELECT id FROM equipment WHERE id = $1 AND organization_id = $2 AND branch_id = $3 AND status <> 'archived' FOR UPDATE`,
      [event.equipmentId, scope.organizationId, scope.branchId],
    );
    if (!equipment.rowCount) throw new Error("تجهیز پیدا نشد یا در این شعبه در دسترس نیست.");

    const version = await client.query<{ status: string }>(
      `SELECT status FROM checklist_template_versions WHERE id = $1 AND organization_id = $2`,
      [event.checklistVersionId, scope.organizationId],
    );
    if (version.rows[0]?.status !== "published") throw new Error("نسخهٔ چک‌لیست منتشرشده پیدا نشد.");

    if (event.scheduleId) {
      const schedule = await client.query<{ id: string }>(
        `SELECT id FROM inspection_schedules
          WHERE id = $1 AND organization_id = $2 AND branch_id = $3 AND equipment_id = $4
            AND checklist_version_id = $5 AND is_active = true
            AND (assigned_user_id IS NULL OR assigned_user_id = $6)`,
        [event.scheduleId, scope.organizationId, scope.branchId, event.equipmentId, event.checklistVersionId, actor.id],
      );
      if (!schedule.rowCount) throw new Error("برنامهٔ بازرسی برای این تجهیز معتبر نیست.");
    }

    const questions = await client.query<{ id: string; prompt: string; required: boolean; fail_creates_defect: boolean }>(
      `SELECT id, prompt, required, fail_creates_defect FROM checklist_questions
        WHERE template_version_id = $1 AND organization_id = $2 ORDER BY position`,
      [event.checklistVersionId, scope.organizationId],
    );
    const answerMap = new Map(event.answers.map((answer) => [answer.questionId, answer]));
    if (answerMap.size !== event.answers.length) throw new Error("پاسخ تکراری در فرم وجود دارد.");
    const questionIds = new Set(questions.rows.map((question) => question.id));
    if (event.answers.some((answer) => !questionIds.has(answer.questionId))) throw new Error("فرم با نسخهٔ انتخاب‌شده هم‌خوانی ندارد.");
    if (questions.rows.some((question) => question.required && !answerMap.has(question.id))) {
      throw new Error("به همهٔ موارد الزامی چک‌لیست پاسخ دهید.");
    }
    if (!questions.rowCount) throw new Error("چک‌لیست موردی برای ثبت ندارد.");

    const syncInsert = await client.query<{ id: string }>(
      `INSERT INTO offline_sync_events
         (id, organization_id, branch_id, client_event_id, actor_user_id, event_type, schema_version,
          local_event_time, status, retry_count, payload_sha256)
       VALUES ($1, $2, $3, $4, $5, 'inspection.submit', $6, $7, 'synced', $8, $9)
       ON CONFLICT (organization_id, client_event_id) DO NOTHING
       RETURNING id`,
      [randomUUID(), scope.organizationId, scope.branchId, event.clientEventId, actor.id, event.schemaVersion, event.localEventTime, Math.max(0, Math.min(100, Math.floor(retryCount))), payloadHash],
    );
    if (!syncInsert.rowCount) {
      const previous = await client.query<{ payload_sha256: string; result_inspection_id: string | null }>(
        `SELECT payload_sha256, result_inspection_id FROM offline_sync_events
          WHERE organization_id = $1 AND client_event_id = $2`,
        [scope.organizationId, event.clientEventId],
      );
      await client.query("ROLLBACK");
      const item = previous.rows[0];
      return item?.payload_sha256 === payloadHash && item.result_inspection_id
        ? { status: "synced", inspectionId: item.result_inspection_id, duplicate: true }
        : { status: "conflict" };
    }

    const inspectionId = randomUUID();
    const hasFindings = event.answers.some((answer) => answer.answer === "fail");
    await client.query(
      `INSERT INTO inspections
         (id, organization_id, branch_id, equipment_id, schedule_id, checklist_version_id, inspector_id,
          outcome, notes, client_event_id, local_occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [inspectionId, scope.organizationId, scope.branchId, event.equipmentId, event.scheduleId ?? null,
        event.checklistVersionId, actor.id, hasFindings ? "findings" : "no_findings", event.notes, event.clientEventId, event.localEventTime],
    );

    const questionsById = new Map(questions.rows.map((question) => [question.id, question]));
    for (const answer of answerPayload) {
      const question = questionsById.get(answer.questionId)!;
      const answerId = randomUUID();
      await client.query(
        `INSERT INTO inspection_answers (id, organization_id, inspection_id, question_id, answer, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [answerId, scope.organizationId, inspectionId, answer.questionId, answer.answer, answer.notes || null],
      );
      if (answer.answer === "fail" && question.fail_creates_defect) {
        const defectId = randomUUID();
        const correctiveActionId = randomUUID();
        const description = answer.notes.trim() || "مورد نامنطبق در بازرسی ثبت شد؛ بررسی انسانی لازم است.";
        await client.query(
          `INSERT INTO defects (id, organization_id, branch_id, equipment_id, inspection_id, answer_id,
                                title, description, severity, reported_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'medium', $9)`,
          [defectId, scope.organizationId, scope.branchId, event.equipmentId, inspectionId, answerId, question.prompt, description, actor.id],
        );
        await client.query(
          `INSERT INTO corrective_actions (id, organization_id, branch_id, defect_id, description)
           VALUES ($1, $2, $3, $4, $5)`,
          [correctiveActionId, scope.organizationId, scope.branchId, defectId, `بررسی انسانی و اقدام اصلاحی برای: ${question.prompt}`],
        );
        await recordAudit(client, {
          actorId: actor.id,
          organizationId: scope.organizationId,
          branchId: scope.branchId,
          action: "defect.created_from_inspection",
          entityType: "defect",
          entityId: defectId,
          metadata: { inspectionId, equipmentId: event.equipmentId, severity: "medium" },
        });
      }
    }

    for (const file of preparedFiles) {
      await privateStorage.put(file.key, file.bytes);
      storedKeys.push(file.key);
      await client.query(
        `INSERT INTO file_objects
           (id, organization_id, branch_id, storage_key, original_name, mime_type, size_bytes, sha256, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [file.id, scope.organizationId, scope.branchId, file.key, file.name, file.mimeType, file.size, file.sha256, actor.id],
      );
      await client.query(
        `INSERT INTO inspection_attachments (id, organization_id, branch_id, inspection_id, file_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), scope.organizationId, scope.branchId, inspectionId, file.id],
      );
    }

    if (event.scheduleId) {
      await client.query(
        `UPDATE inspection_schedules
            SET next_due_at = CASE frequency
              WHEN 'daily' THEN next_due_at + interval '1 day'
              WHEN 'weekly' THEN next_due_at + interval '7 days'
              WHEN 'monthly' THEN next_due_at + interval '1 month'
              WHEN 'custom' THEN next_due_at + (interval '1 day' * interval_days)
            END
          WHERE id = $1 AND organization_id = $2 AND branch_id = $3`,
        [event.scheduleId, scope.organizationId, scope.branchId],
      );
    }
    await client.query(
      `UPDATE offline_sync_events SET result_inspection_id = $1
        WHERE organization_id = $2 AND client_event_id = $3`,
      [inspectionId, scope.organizationId, event.clientEventId],
    );
    await recordAudit(client, {
      actorId: actor.id,
      organizationId: scope.organizationId,
      branchId: scope.branchId,
      action: "inspection.submitted",
      entityType: "inspection",
      entityId: inspectionId,
      metadata: { equipmentId: event.equipmentId, outcome: hasFindings ? "findings" : "no_findings", attachmentCount: preparedFiles.length },
    });
    await client.query("COMMIT");
    return { status: "synced", inspectionId };
  } catch (error) {
    await client.query("ROLLBACK");
    await Promise.all(storedKeys.map((key) => privateStorage.remove(key).catch(() => undefined)));
    throw error;
  } finally {
    client.release();
  }
}
