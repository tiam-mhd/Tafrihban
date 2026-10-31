"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inspectionEventSchema } from "@/modules/inspections/schema";
import { saveLocalInspection, syncLocalInspection, type LocalInspectionEvent } from "@/lib/offline-queue";

type Question = { id: string; prompt: string; guidance: string | null; required: boolean };

export function InspectionForm({ input, questions, accountId }: {
  input: { organizationId: string; branchId: string; equipmentId: string; checklistVersionId: string; scheduleId?: string };
  questions: Question[];
  accountId: string;
}) {
  const [answers, setAnswers] = useState<Record<string, { answer: "pass" | "fail" | "na" | ""; notes: string }>>({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const notes = new FormData(event.currentTarget).get("inspectionNotes");
    const payload = {
      clientEventId: crypto.randomUUID(),
      schemaVersion: 1 as const,
      ...input,
      localEventTime: new Date().toISOString(),
      notes: typeof notes === "string" ? notes.trim() : "",
      answers: questions.map((question) => ({ questionId: question.id, answer: answers[question.id]?.answer, notes: answers[question.id]?.notes || "" })),
    };
    const parsed = inspectionEventSchema.safeParse(payload);
    if (!parsed.success) {
      setMessage("پاسخ همهٔ موارد لازم را کامل کنید.");
      return;
    }
    if (images.length > 2 || images.some((file) => file.size > 5 * 1024 * 1024)) {
      setMessage("حداکثر دو تصویر ۵ مگابایتی می‌توانید پیوست کنید.");
      return;
    }
    setSubmitting(true);
    try {
      const item: LocalInspectionEvent = {
        clientEventId: parsed.data.clientEventId,
        accountId,
        event: parsed.data,
        attachments: images.map((file) => ({ name: file.name, type: file.type, blob: file })),
        status: "queued",
        retryCount: 0,
        queuedAt: new Date().toISOString(),
      };
      await saveLocalInspection(item);
      if (navigator.onLine) await syncLocalInspection(item);
      setMessage(navigator.onLine ? "درخواست ارسال شد؛ نتیجه را در صف همگام‌سازی ببینید." : "در انتظار همگام‌سازی؛ این بازرسی هنوز در سرور ثبت نشده است.");
      router.refresh();
    } catch {
      setMessage("ذخیرهٔ محلی در این مرورگر ممکن نشد؛ پاسخ‌ها را کپی و دوباره تلاش کنید.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-stack inspection-form" onSubmit={submit}>
      <div className="inspection-banner"><span className="state-icon">i</span><p>ثبت پاسخ، دستگاه را ایمن یا مجاز به بهره‌برداری اعلام نمی‌کند. تصمیم با متخصص انسانی است.</p></div>
      <ol className="question-list">
        {questions.map((question, index) => (
          <li key={question.id} className="question-card">
            <div className="question-title"><span>{String(index + 1).padStart(2, "۰")}</span><div><strong>{question.prompt}{question.required && <i aria-label="الزامی"> *</i>}</strong>{question.guidance && <small>{question.guidance}</small>}</div></div>
            <fieldset className="answer-options"><legend className="sr-only">پاسخ به {question.prompt}</legend>
              {([["pass", "مطابق"], ["fail", "مورد دارد"], ["na", "قابل ارزیابی نیست"]] as const).map(([value, label]) => (
                <label key={value} className={answers[question.id]?.answer === value ? `answer-choice selected answer-${value}` : "answer-choice"}>
                  <input type="radio" name={`answer-${question.id}`} value={value} checked={answers[question.id]?.answer === value} onChange={() => setAnswers((current) => ({ ...current, [question.id]: { ...current[question.id], answer: value, notes: current[question.id]?.notes || "" } }))} required={question.required} />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            {answers[question.id]?.answer === "fail" && <label className="field-label">شرح مورد نامنطبق<textarea maxLength={2000} value={answers[question.id]?.notes || ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: { ...current[question.id], answer: "fail", notes: event.target.value } }))} rows={2} /></label>}
          </li>
        ))}
      </ol>
      <label className="field-label">یادداشت بازرسی<textarea name="inspectionNotes" rows={3} maxLength={4000} /></label>
      <label className="field-label">عکس مدرک (اختیاری)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setImages(Array.from(event.target.files || []))} /><small>تصویر پیش از ارسال محلی می‌ماند و پس از اتصال از مسیر خصوصی بارگذاری می‌شود.</small></label>
      {message && <p className="notice notice-info" role="status">{message}</p>}
      <button className="button button-primary button-large" type="submit" disabled={submitting}>{submitting ? "در حال ذخیرهٔ محلی…" : "ذخیره و ارسال بازرسی"}</button>
    </form>
  );
}
