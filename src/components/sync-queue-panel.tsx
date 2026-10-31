"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { listLocalInspections, patchLocalInspection, syncLocalInspection, type LocalInspectionEvent } from "@/lib/offline-queue";

const labels = {
  queued: "در انتظار همگام‌سازی",
  syncing: "در حال ارسال به سرور",
  failed: "ارسال ناموفق؛ نیازمند تلاش دوباره",
  conflict: "تعارض؛ نیازمند بررسی انسانی",
  synced: "ثبت‌شده و تأییدشده توسط سرور",
} as const;

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function onlineSnapshot() { return navigator.onLine; }
function serverOnlineSnapshot() { return true; }

export function SyncQueuePanel({ accountId }: { accountId: string }) {
  const [items, setItems] = useState<LocalInspectionEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const isOnline = useSyncExternalStore(subscribeOnline, onlineSnapshot, serverOnlineSnapshot);

  const loadItems = useCallback(async () => {
    try {
      const next = await listLocalInspections(accountId);
      const recovered = next.map((item) => item.status === "syncing" ? { ...item, status: "queued" as const } : item);
      for (const item of recovered) if (item.status !== "syncing" && next.find((old) => old.clientEventId === item.clientEventId)?.status === "syncing") await patchLocalInspection(item.clientEventId, { status: "queued" });
      return recovered;
    } catch {
      return [];
    }
  }, [accountId]);

  const refresh = useCallback(async () => setItems(await loadItems()), [loadItems]);

  useEffect(() => {
    let active = true;
    void loadItems().then((next) => { if (active) setItems(next); });
    const changed = () => void refresh();
    const online = () => void refresh();
    const membershipRevoked = () => setRevoked(true);
    window.addEventListener("tafrihban:queue-changed", changed);
    window.addEventListener("online", online);
    window.addEventListener("tafrihban:membership-revoked", membershipRevoked);
    return () => {
      window.removeEventListener("tafrihban:queue-changed", changed);
      window.removeEventListener("online", online);
      window.removeEventListener("tafrihban:membership-revoked", membershipRevoked);
      active = false;
    };
  }, [loadItems, refresh]);

  async function syncAll() {
    setBusy(true);
    try {
      const pending = items.filter((item) => item.status === "queued" || item.status === "failed");
      for (const item of pending) await syncLocalInspection(item);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function retry(item: LocalInspectionEvent) {
    await patchLocalInspection(item.clientEventId, { status: "queued" });
    await syncLocalInspection({ ...item, status: "queued" });
    await refresh();
  }

  const pendingCount = items.filter((item) => item.status !== "synced").length;
  return (
    <section className="panel sync-panel" aria-labelledby="sync-queue-title">
      <div className="section-heading compact-heading">
        <div><span className="eyebrow">حفظ محلی از سرور جداست</span><h2 id="sync-queue-title">صف همگام‌سازی</h2></div>
        {pendingCount > 0 && <button className="button button-secondary button-small" onClick={syncAll} disabled={busy || !isOnline}>{!isOnline ? "در انتظار اینترنت" : busy ? "در حال ارسال…" : "ارسال موارد آماده"}</button>}
      </div>
      {revoked && <p className="notice notice-warning" role="alert">دسترسی این حساب تغییر کرده است؛ داده‌های محلی این حساب پاک شد. دوباره وارد شوید یا با مدیر شعبه هماهنگ کنید.</p>}
      {!items.length ? <div className="empty-inline"><span className="state-icon">✓</span><p>صف محلی خالی است.</p></div> : (
        <ul className="queue-list">
          {items.map((item) => <li key={item.clientEventId} className={`queue-item queue-${item.status}`}>
            <div><strong>{labels[item.status]}</strong><span>{item.event.answers.length} پاسخ · {new Date(item.queuedAt).toLocaleString("fa-IR")}</span>{item.message && <small>{item.message}</small>}</div>
            {(item.status === "failed" || item.status === "conflict") && <button type="button" className="link-button" onClick={() => void retry(item)} disabled={busy}>{item.status === "conflict" ? "بررسی جزئیات" : "تلاش دوباره"}</button>}
          </li>)}
        </ul>
      )}
      <p className="tiny-note">تا وقتی وضعیت «ثبت‌شده و تأییدشده توسط سرور» نیست، بازرسی نهایی ثبت نشده است.</p>
    </section>
  );
}
