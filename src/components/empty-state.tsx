import type { ReactNode } from "react";

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><span className="state-icon">i</span><h2>{title}</h2><p>{children}</p>{action}</div>;
}

export function AccessDenied() {
  return <div className="notice notice-warning" role="status"><strong>دسترسی لازم در این محدوده وجود ندارد.</strong><br />از مدیر مجموعه بخواهید عضویت یا نقش مناسب را بررسی کند.</div>;
}

export function FormNotice({ searchParams }: { searchParams?: { error?: string; saved?: string } }) {
  if (searchParams?.saved) return <p className="notice notice-success" role="status">تغییر با موفقیت ثبت شد.</p>;
  const errors: Record<string, string> = {
    invalid: "اطلاعات فرم کامل یا معتبر نیست.",
    "permission-denied": "نقش انتخاب‌شده یا محدودهٔ درخواستی خارج از اختیار شماست.",
    timezone: "منطقهٔ زمانی معتبر نیست.",
    "invalid-time": "زمان واردشده با منطقهٔ زمانی شعبه سازگار نیست.",
    "account-create-failed": "حساب ساخته یا به محدوده متصل نشد؛ شمارهٔ همراه را بررسی کنید.",
    "manager-account": "حساب مدیر مجموعه ساخته یا متصل نشد؛ شمارهٔ همراه را بررسی کنید.",
    "could-not-save": "تغییر ثبت نشد. کد یا شناسهٔ تکراری را بررسی کنید.",
    "invalid-transition": "این جابه‌جایی وضعیت مجاز نیست یا اطلاعات تکمیل کافی نیست.",
  };
  if (!searchParams?.error) return null;
  return <p className="notice notice-warning" role="alert">{errors[searchParams.error] || "درخواست انجام نشد؛ اطلاعات و دسترسی خود را بررسی کنید."}</p>;
}
