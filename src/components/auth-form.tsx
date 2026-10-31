"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { operationalAuthClient, platformAuthClient } from "@/lib/auth-client";

export function AuthForm({ platform = false }: { platform?: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!platform) return;
    const verifyTwoFactor = () => router.push("/platform/two-factor");
    window.addEventListener("tafrihban:platform-two-factor", verifyTwoFactor);
    return () => window.removeEventListener("tafrihban:platform-two-factor", verifyTwoFactor);
  }, [platform, router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    const input = { email: String(values.get("email") || "").trim().toLowerCase(), password: String(values.get("password") || "") };
    try {
      const result = platform
        ? await platformAuthClient.signIn.email({ ...input, callbackURL: "/platform" })
        : await operationalAuthClient.signIn.email({ ...input, callbackURL: "/app/select-scope" });
      if (result.error) {
        setError("ورود انجام نشد. ایمیل و رمز را بررسی کنید یا با مدیر حساب تماس بگیرید.");
        return;
      }
      router.replace(platform ? "/platform" : "/app/select-scope");
      router.refresh();
    } catch {
      setError("ارتباط با سرویس ورود برقرار نشد. چند لحظه بعد دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="form-stack auth-form">
    <label className="field-label">ایمیل<input type="email" name="email" autoComplete="username" required maxLength={254} /></label>
    <label className="field-label">رمز عبور<input type="password" name="password" autoComplete="current-password" required minLength={platform ? 14 : 12} maxLength={128} /></label>
    {error && <p className="notice notice-warning" role="alert">{error}</p>}
    <button className="button button-primary button-large" type="submit" disabled={busy}>{busy ? "در حال بررسی…" : "ورود امن"}</button>
    {!platform && <p className="tiny-note">برای ساخت یا بازیابی حساب با مدیر مجموعه تماس بگیرید.</p>}
    {platform && <p className="tiny-note">ایجاد حساب مدیر پلتفرم فقط از راه bootstrap کنترل‌شده انجام می‌شود.</p>}
  </form>;
}

export function TwoFactorVerifyForm() {
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await platformAuthClient.twoFactor.verifyTotp({ code: String(form.get("code") || "").replace(/\s/g, "") });
      if (result.error) setError("کد تأیید معتبر نیست یا منقضی شده است.");
      else { router.replace("/platform"); router.refresh(); }
    } catch { setError("تأیید دومرحله‌ای انجام نشد."); }
  }
  return <form onSubmit={submit} className="form-stack auth-form">
    <label className="field-label">کد برنامهٔ احراز هویت<input name="code" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={8} required /></label>
    {error && <p role="alert" className="notice notice-warning">{error}</p>}
    <button className="button button-primary" type="submit">تأیید و ورود</button>
  </form>;
}

export function PlatformTwoFactorSetup() {
  const [totpUri, setTotpUri] = useState("");
  const [qr, setQr] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function enable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await platformAuthClient.twoFactor.enable({ password: String(form.get("password") || ""), method: "totp", issuer: "Tafrihban Platform" });
      if (result.error || result.data?.method !== "totp") { setError("راه‌اندازی عامل دوم انجام نشد."); return; }
      setTotpUri(result.data.totpURI);
      setBackupCodes(result.data.backupCodes || []);
      const QRCode = await import("qrcode");
      setQr(await QRCode.toDataURL(result.data.totpURI, { margin: 1, width: 220 }));
    } catch { setError("اطلاعات احراز هویت دومرحله‌ای دریافت نشد."); }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await platformAuthClient.twoFactor.verifyTotp({ code: String(form.get("code") || "").replace(/\s/g, "") });
      if (result.error) setError("کد تأیید معتبر نیست.");
      else setDone(true);
    } catch { setError("کد تأیید انجام نشد."); }
  }

  return <div className="panel narrow-panel">
    {!totpUri ? <form onSubmit={enable} className="form-stack">
      <p>عامل دوم TOTP از طریق برنامهٔ احراز هویت پشتیبانی می‌شود. رمز حساب پلتفرم را برای ساخت secret وارد کنید.</p>
      <label className="field-label">رمز عبور فعلی<input type="password" name="password" autoComplete="current-password" required /></label>
      <button className="button button-primary" type="submit">ساخت عامل دومرحله‌ای</button>
    </form> : <div className="form-stack">
      <p>کد QR را فقط در برنامهٔ احراز هویت خود اسکن کنید. secret را با دیگران به اشتراک نگذارید.</p>
      {qr && <Image className="totp-qr" src={qr} alt="کد راه‌اندازی TOTP" width={220} height={220} unoptimized />}
      <code className="totp-uri">{totpUri}</code>
      {backupCodes.length > 0 && <div className="backup-code-box"><strong>کدهای بازیابی را اکنون در جای امن نگه دارید:</strong><code>{backupCodes.join(" · ")}</code></div>}
      {!done ? <form onSubmit={verify} className="form-stack"><label className="field-label">کد شش‌رقمی<input name="code" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={8} required /></label><button className="button button-primary" type="submit">تأیید فعال‌سازی</button></form> : <p className="notice notice-success">عامل دومرحله‌ای فعال شد.</p>}
    </div>}
    {error && <p className="notice notice-warning" role="alert">{error}</p>}
    <Link className="text-link" href="/platform">بازگشت به مدیریت پلتفرم</Link>
  </div>;
}
