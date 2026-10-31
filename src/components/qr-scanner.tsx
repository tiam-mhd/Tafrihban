"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function QrScanner({ organizationId, branchId }: { organizationId: string; branchId: string }) {
  const [message, setMessage] = useState("");
  const [active, setActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const router = useRouter();

  useEffect(() => () => stopRef.current?.(), []);

  function openResult(raw: string) {
    let qrId = raw.trim();
    try {
      const parsed = new URL(raw, window.location.origin);
      qrId = parsed.searchParams.get("qr") || parsed.pathname.split("/").filter(Boolean).pop() || raw;
    } catch { /* Accept a raw public equipment identifier too. */ }
    if (!/^[0-9a-f-]{36}$/i.test(qrId)) {
      setMessage("کد QR خوانده شد اما شناسهٔ آن معتبر نیست؛ شناسه را دستی وارد کنید.");
      return;
    }
    stopRef.current?.();
    setActive(false);
    router.push(`/app/equipment/lookup?qr=${encodeURIComponent(qrId)}&organizationId=${encodeURIComponent(organizationId)}&branchId=${encodeURIComponent(branchId)}`);
  }

  async function startCamera() {
    setMessage("");
    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      setMessage("اسکن دوربین در تولید به HTTPS نیاز دارد؛ شناسهٔ تجهیز را دستی وارد کنید.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("این مرورگر دوربین را پشتیبانی نمی‌کند؛ شناسهٔ تجهیز را دستی وارد کنید.");
      return;
    }
    setActive(true);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (result) openResult(result.getText());
      });
      stopRef.current = () => controls.stop();
    } catch {
      setActive(false);
      setMessage("دسترسی دوربین برقرار نشد؛ شناسهٔ تجهیز را دستی وارد کنید.");
    }
  }

  return <div className="scanner-card">
    {active && <video ref={videoRef} className="scanner-video" muted playsInline aria-label="نمای دوربین برای خواندن QR" />}
    <button type="button" className="button button-secondary" onClick={() => active ? (stopRef.current?.(), setActive(false)) : void startCamera()}>{active ? "توقف اسکن" : "اسکن QR با دوربین"}</button>
    {message && <p className="notice notice-info" role="status">{message}</p>}
    <form action="/app/equipment/lookup" method="get" className="manual-lookup">
      <input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="branchId" value={branchId} />
      <label className="field-label">شناسه یا کد تجهیز<input name="code" required placeholder="مثلاً EQ-014" autoComplete="off" /></label>
      <button className="button button-secondary" type="submit">جست‌وجوی دستی</button>
    </form>
  </div>;
}
