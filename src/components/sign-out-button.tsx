"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { operationalAuthClient, platformAuthClient } from "@/lib/auth-client";
import { clearLocalAccountData } from "@/lib/offline-queue";

export function SignOutButton({ accountId, platform }: { accountId: string; platform: boolean }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function signOut() {
    setBusy(true);
    try {
      if (platform) await platformAuthClient.signOut();
      else {
        await operationalAuthClient.signOut();
        await clearLocalAccountData(accountId);
      }
      router.replace(platform ? "/platform/login" : "/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return <button className="link-button" type="button" onClick={signOut} disabled={busy}>{busy ? "در حال خروج…" : "خروج امن"}</button>;
}
