import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";

// Keep the Next.js cookie bridge last so auth responses from Server Actions,
// including password changes, persist their Set-Cookie headers.
export const platformAuthPlugins = [
  twoFactor({ issuer: "Tafrihban Platform", twoFactorTable: "platform_admin_two_factors" }),
  nextCookies(),
];
