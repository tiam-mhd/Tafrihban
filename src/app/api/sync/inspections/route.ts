import { NextResponse } from "next/server";
import { inspectionEventSchema } from "@/modules/inspections/schema";
import { submitInspection } from "@/modules/inspections/service";
import { operationalActorFromRequest } from "@/server/auth-guards";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 11 * 1024 * 1024;

async function readBoundedRequest(request: Request): Promise<Request | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    total += item.value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(item.value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new Request(request.url, { method: "POST", headers: request.headers, body: body.buffer });
}

export async function POST(request: Request) {
  const actor = await operationalActorFromRequest(request);
  if (!actor) return NextResponse.json({ status: "failed", message: "برای همگام‌سازی دوباره وارد شوید." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  try {
    const boundedRequest = await readBoundedRequest(request);
    if (!boundedRequest) return NextResponse.json({ status: "failed", message: "حجم درخواست از حد مجاز بیشتر است." }, { status: 413, headers: { "Cache-Control": "no-store" } });
    const contentType = boundedRequest.headers.get("content-type") || "";
    const retryHeader = boundedRequest.headers.get("x-tafrihban-retry-count");
    const retryCount = retryHeader === null ? 0 : Number(retryHeader);
    if (!Number.isInteger(retryCount) || retryCount < 0 || retryCount > 100) return NextResponse.json({ status: "failed", message: "تعداد تلاش نامعتبر است." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    let event: unknown;
    let files: File[] = [];
    if (contentType.includes("multipart/form-data")) {
      const form = await boundedRequest.formData();
      const raw = form.get("event");
      if (typeof raw !== "string" || raw.length > 100_000) {
        return NextResponse.json({ status: "failed", message: "اطلاعات بازرسی معتبر نیست." }, { status: 400, headers: { "Cache-Control": "no-store" } });
      }
      event = JSON.parse(raw);
      files = form.getAll("attachments").filter((value): value is File => value instanceof File);
    } else {
      event = await boundedRequest.json();
    }

    const parsed = inspectionEventSchema.safeParse(event);
    if (!parsed.success) return NextResponse.json({ status: "failed", message: "فرم بازرسی ناقص یا نامعتبر است." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    const result = await submitInspection(actor, parsed.data, files, retryCount);
    if (result.status === "conflict") {
      return NextResponse.json({ status: "conflict", message: "شناسهٔ این رویداد با محتوای دیگری ثبت شده است؛ هر دو نسخه را نگه دارید و با مدیر شعبه هماهنگ کنید." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ status: "synced", inspectionId: result.inspectionId, duplicate: Boolean(result.duplicate) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "";
    const forbidden = safeMessage.includes("اجازه") || safeMessage.includes("محدوده");
    const message = forbidden ? "برای این محدوده اجازهٔ ثبت ندارید." : "ثبت بازرسی انجام نشد؛ دوباره تلاش کنید یا با مدیر شعبه هماهنگ کنید.";
    const status = forbidden ? 403 : 422;
    return NextResponse.json({ status: "failed", message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
