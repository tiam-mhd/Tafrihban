import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { requiredEnv } from "@/lib/env";

function signingKey(): Uint8Array {
  const secret = requiredEnv("FILE_URL_SECRET");
  if (new TextEncoder().encode(secret).byteLength < 32) throw new Error("FILE_URL_SECRET must be at least 32 bytes.");
  return new TextEncoder().encode(secret);
}

export async function createPrivateFileToken(fileId: string): Promise<string> {
  return new SignJWT({ fileId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("tafrihban")
    .setAudience("private-files")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(signingKey());
}

export async function readPrivateFileToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, signingKey(), { issuer: "tafrihban", audience: "private-files" });
  if (typeof payload.fileId !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.fileId)) throw new Error("Invalid private file token.");
  return payload.fileId;
}
