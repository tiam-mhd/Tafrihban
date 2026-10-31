import "server-only";

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function authBaseUrl(): string {
  return process.env.BETTER_AUTH_URL?.trim() || "http://localhost:3000";
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
