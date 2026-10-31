"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { operationalAuthClient, platformAuthClient } from "@/lib/auth-client";
import { normalizeIranianMobile } from "@/modules/identity/iranian-phone";

export function AuthForm({ platform = false }: { platform?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!platform) return;
    const verifyTwoFactor = () => router.push("/platform/two-factor");
    window.addEventListener("tafrihban:platform-two-factor", verifyTwoFactor);
    return () => window.removeEventListener("tafrihban:platform-two-factor", verifyTwoFactor);
  }, [platform, router]);

  if (!platform) return <OperationalOtpForm />;

  async function submitPlatformLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const input = { email: String(values.get("email") || "").trim().toLowerCase(), password: String(values.get("password") || "") };
    try {
      const result = await platformAuthClient.signIn.email({ ...input, callbackURL: "/platform" });
      if (result.error) return;
      router.replace("/platform");
      router.refresh();
    } catch { /* Keep platform login errors generic. */ }
  }

  return <form onSubmit={submitPlatformLogin} className="form-stack auth-form">
    <label className="field-label">ایمیل<input type="email" name="email" autoComplete="username" required maxLength={254} /></label>
    <label className="field-label">رمز عبور<input type="password" name="password" autoComplete="current-password" required minLength={14} maxLength={128} /></label>
    <button className="button button-primary button-large" type="submit">ورود امن</button>
    <p className="tiny-note">ایجاد حساب مدیر پلتفرم فقط از راه bootstrap کنترل‌شده انجام می‌شود.</p>
  </form>;
}

function OperationalOtpForm() {
  const [phone, setPhone] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function requestCode() {
    const normalized = normalizeIranianMobile(phone);
    if (!normalized) {
      setError("شمارهٔ همراه ایران را به‌شکل ۰۹… یا ‎+۹۸… وارد کنید.");
      return;
    }
    setBusy(true);
    setError("");
    setPhoneNumber(normalized);
    setCodeRequested(true);
    try {
      await operationalAuthClient.phoneNumber.sendOtp({ phoneNumber: normalized });
    } catch {
      // The same next step is shown for known, unknown, and unavailable accounts.
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!codeRequested) {
      await requestCode();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await operationalAuthClient.phoneNumber.verify({ phoneNumber, code: code.trim() });
      if (result.error) {
        setError("کد معتبر نیست یا مهلتش تمام شده است. کد تازه بگیرید و دوباره تلاش کنید.");
        return;
      }
      router.replace("/app/select-scope");
      router.refresh();
    } catch {
      setError("ورود انجام نشد. کد تازه بگیرید یا با مدیر محدوده تماس بگیرید.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="form-stack auth-form">
    <label className="field-label">شمارهٔ همراه ثبت‌شده
      <input
        type="tel"
        name="phone"
        dir="ltr"
        inputMode="tel"
        autoComplete="tel"
        required
        minLength={7}
        maxLength={30}
        value={phone}
        disabled={codeRequested}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="09..."
      />
    </label>
    {codeRequested && <>
      <p className="notice notice-info" role="status">اگر این شماره به حساب فعالی متصل باشد، کد ورود ارسال می‌شود. برای ساخت حساب با مدیر مجموعه یا شعبه تماس بگیرید.</p>
      <label className="field-label">کد یک‌بارمصرف شش‌رقمی
        <input
          type="text"
          name="code"
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))}
        />
      </label>
    </>}
    {error && <p className="notice notice-warning" role="alert">{error}</p>}
    {!codeRequested
      ? <button className="button button-primary button-large" type="submit" disabled={busy}>{busy ? "در حال ارسال…" : "دریافت کد ورود"}</button>
      : <div className="otp-actions">
        <button className="button button-primary button-large" type="submit" disabled={busy || code.length !== 6}>{busy ? "در حال بررسی…" : "تأیید و ورود"}</button>
        <button className="button button-secondary" type="button" onClick={() => void requestCode()} disabled={busy}>ارسال دوبارهٔ کد</button>
        <button className="link-button" type="button" onClick={() => { setCodeRequested(false); setCode(""); setError(""); }}>ویرایش شماره</button>
      </div>}
    <p className="tiny-note">ثبت‌نام عمومی فعال نیست؛ حساب باید پیش‌تر توسط مدیر محدوده ساخته شده باشد.</p>
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
