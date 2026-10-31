"use client";

import type { InspectionEventInput } from "@/modules/inspections/types";

export type LocalQueueStatus = "queued" | "syncing" | "failed" | "conflict" | "synced";

export type LocalInspectionEvent = {
  clientEventId: string;
  accountId: string;
  event: InspectionEventInput;
  attachments: { name: string; type: string; blob: Blob }[];
  status: LocalQueueStatus;
  retryCount: number;
  message?: string;
  queuedAt: string;
  syncedAt?: string;
};

const DATABASE_NAME = "tafrihban-local-events";
const STORE_NAME = "inspection-events";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "clientEventId" });
        store.createIndex("accountId", "accountId", { unique: false });
        store.createIndex("status", "status", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("ذخیرهٔ محلی در دسترس نیست."));
  });
}

async function withStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("عملیات ذخیرهٔ محلی ناموفق بود."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
    transaction.onabort = () => database.close();
  });
}

export function saveLocalInspection(item: LocalInspectionEvent): Promise<IDBValidKey> {
  return withStore("readwrite", (store) => store.put(item)).then((result) => {
    window.dispatchEvent(new Event("tafrihban:queue-changed"));
    return result;
  });
}

export async function listLocalInspections(accountId: string): Promise<LocalInspectionEvent[]> {
  const rows = await withStore("readonly", (store) => store.index("accountId").getAll(accountId));
  return (rows as LocalInspectionEvent[]).sort((a, b) => b.queuedAt.localeCompare(a.queuedAt));
}

export async function patchLocalInspection(clientEventId: string, patch: Partial<LocalInspectionEvent>): Promise<void> {
  const current = await withStore("readonly", (store) => store.get(clientEventId)) as LocalInspectionEvent | undefined;
  if (!current) return;
  await withStore("readwrite", (store) => store.put({ ...current, ...patch }));
  window.dispatchEvent(new Event("tafrihban:queue-changed"));
}

export async function clearLocalAccountData(accountId: string): Promise<void> {
  const items = await listLocalInspections(accountId);
  for (const item of items) await withStore("readwrite", (store) => store.delete(item.clientEventId));
  window.dispatchEvent(new Event("tafrihban:queue-changed"));
}

export async function syncLocalInspection(item: LocalInspectionEvent): Promise<LocalQueueStatus> {
  if (!navigator.onLine) {
    await patchLocalInspection(item.clientEventId, { status: "queued", message: "تا برقراری اینترنت در دستگاه می‌ماند." });
    return "queued";
  }
  await patchLocalInspection(item.clientEventId, { status: "syncing", message: undefined });
  const form = new FormData();
  form.set("event", JSON.stringify(item.event));
  for (const attachment of item.attachments) {
    form.append("attachments", new File([attachment.blob], attachment.name, { type: attachment.type }));
  }
  try {
    const response = await fetch("/api/sync/inspections", { method: "POST", body: form, cache: "no-store", headers: { "X-Tafrihban-Retry-Count": String(item.retryCount) } });
    const body = await response.json() as { status?: string; message?: string };
    if (response.status === 403) {
      await clearLocalAccountData(item.accountId);
      window.dispatchEvent(new Event("tafrihban:membership-revoked"));
      return "failed";
    }
    if (response.status === 409 || body.status === "conflict") {
      await patchLocalInspection(item.clientEventId, { status: "conflict", retryCount: item.retryCount + 1, message: body.message || "تعارض نیازمند بررسی انسانی است." });
      return "conflict";
    }
    if (!response.ok || body.status !== "synced") {
      await patchLocalInspection(item.clientEventId, { status: "failed", retryCount: item.retryCount + 1, message: body.message || "ثبت در سرور انجام نشد." });
      return "failed";
    }
    await patchLocalInspection(item.clientEventId, { status: "synced", retryCount: item.retryCount + 1, syncedAt: new Date().toISOString(), message: "سرور ثبت بازرسی را تأیید کرد." });
    return "synced";
  } catch {
    const status: LocalQueueStatus = navigator.onLine ? "failed" : "queued";
    await patchLocalInspection(item.clientEventId, { status, retryCount: item.retryCount + 1, message: navigator.onLine ? "پاسخی از سرور دریافت نشد؛ دوباره تلاش کنید." : "تا برقراری اینترنت در دستگاه می‌ماند." });
    return status;
  }
}
