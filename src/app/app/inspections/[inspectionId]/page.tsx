import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pool } from "@/db";
import { formatBranchTime } from "@/lib/dates";
import { createPrivateFileToken } from "@/lib/file-tokens";
import { OperationalShell } from "@/components/operational-shell";
import { AccessDenied } from "@/components/empty-state";
import { requireOperationalActor, requireOperationalScope, hasOperationalPermission } from "@/server/auth-guards";

type Search = Promise<{ organizationId?: string; branchId?: string }>;

export default async function InspectionDetailPage({ params, searchParams }: { params: Promise<{ inspectionId: string }>; searchParams: Search }) {
  const routeParams = await params;
  const query = await searchParams;
  const actor = await requireOperationalActor();
  const scope = await requireOperationalScope(actor, query.organizationId, query.branchId);
  if (!(await hasOperationalPermission(scope, "inspection.read"))) return <OperationalShell scope={scope} title="جزئیات بازرسی"><AccessDenied /></OperationalShell>;
  const inspection = await pool.query<{ id: string; equipment_id: string; asset_code: string; equipment_name: string; outcome: string; notes: string | null; created_at: Date; inspector_name: string }>(
    `SELECT i.id, i.equipment_id, e.asset_code, e.name AS equipment_name, i.outcome, i.notes, i.created_at, u.name AS inspector_name
       FROM inspections i JOIN equipment e ON e.id = i.equipment_id AND e.organization_id = i.organization_id AND e.branch_id = i.branch_id
       JOIN users u ON u.id = i.inspector_id
      WHERE i.id = $1 AND i.organization_id = $2 AND i.branch_id = $3`, [routeParams.inspectionId, scope.organizationId, scope.branchId]);
  const item = inspection.rows[0];
  if (!item) notFound();
  const [answers, files] = await Promise.all([
    pool.query<{ prompt: string; answer: string; notes: string | null }>(
      `SELECT q.prompt, a.answer, a.notes FROM inspection_answers a
         JOIN checklist_questions q ON q.id = a.question_id AND q.organization_id = a.organization_id
         JOIN inspections i ON i.id = a.inspection_id AND i.organization_id = a.organization_id
        WHERE a.inspection_id = $1 AND a.organization_id = $2 AND i.branch_id = $3 ORDER BY q.position`, [item.id, scope.organizationId, scope.branchId]),
    pool.query<{ id: string; original_name: string; mime_type: string }>(
      `SELECT f.id, f.original_name, f.mime_type FROM inspection_attachments a
         JOIN file_objects f ON f.id = a.file_id AND f.organization_id = a.organization_id AND f.branch_id = a.branch_id
        WHERE a.inspection_id = $1 AND a.organization_id = $2 AND a.branch_id = $3 ORDER BY a.created_at`, [item.id, scope.organizationId, scope.branchId]),
  ]);
  const urls = await Promise.all(files.rows.map(async (file) => ({ ...file, url: `/api/files/${file.id}?token=${encodeURIComponent(await createPrivateFileToken(file.id))}` })));
  const scopeParams = `organizationId=${scope.organizationId}&branchId=${scope.branchId}`;
  return <OperationalShell scope={scope} title="جزئیات بازرسی">
    <section className="panel"><div className="section-heading"><div><span className="eyebrow">{formatBranchTime(item.created_at, scope.timezone)}</span><h2>{item.equipment_name} · {item.asset_code}</h2><p>بازرس: {item.inspector_name}</p></div><span className="pill">{item.outcome === "findings" ? "دارای مورد نامنطبق" : "بدون مورد نامنطبق ثبت‌شده"}</span></div>
      <p className="inspection-banner">این سابقه نتیجهٔ فرم را نشان می‌دهد و تأیید ایمنی یا مجوز بهره‌برداری نیست.</p>
      <ol className="question-list">{answers.rows.map((answer, index) => <li className="question-card" key={`${index}-${answer.prompt}`}><div className="question-title"><span>{index + 1}</span><div><strong>{answer.prompt}</strong><small>{answerLabel(answer.answer)}</small>{answer.notes && <small>یادداشت: {answer.notes}</small>}</div></div></li>)}</ol>
      <p><strong>یادداشت بازرسی:</strong> {item.notes || "ثبت نشده"}</p>
      {urls.length > 0 && <section className="attachment-grid" aria-label="پیوست‌های خصوصی">{urls.map((file) => <a href={file.url} target="_blank" rel="noreferrer" key={file.id}><Image src={file.url} alt={file.original_name} width={240} height={180} unoptimized /><span>{file.original_name}</span></a>)}</section>}
      <Link className="button button-secondary" href={`/app/equipment/lookup?code=${encodeURIComponent(item.asset_code)}&${scopeParams}`}>بازگشت به پروندهٔ تجهیز</Link>
    </section>
  </OperationalShell>;
}

function answerLabel(value: string) { return ({ pass: "مطابق", fail: "مورد نامنطبق", na: "قابل ارزیابی نبود" } as Record<string, string>)[value] || value; }
