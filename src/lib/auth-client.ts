"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const operationalAuthClient = createAuthClient({ basePath: "/api/auth" });

export const platformAuthClient = createAuthClient({
  basePath: "/api/platform-auth",
  plugins: [twoFactorClient({ onTwoFactorRedirect: () => { window.dispatchEvent(new Event("tafrihban:platform-two-factor")); } })],
});
