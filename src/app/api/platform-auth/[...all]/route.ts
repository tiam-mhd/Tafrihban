import { toNextJsHandler } from "better-auth/next-js";
import { platformAuth } from "@/lib/platform-auth";

const handlers = toNextJsHandler(platformAuth);

function isBlockedPath(request: Request): boolean {
  const path = new URL(request.url).pathname;
  return /\/(sign-up|forget-password|reset-password)(\/|$)/.test(path);
}

export async function GET(request: Request) {
  if (isBlockedPath(request)) return new Response(null, { status: 404 });
  return handlers.GET(request);
}

export async function POST(request: Request) {
  if (isBlockedPath(request)) return new Response(null, { status: 404 });
  return handlers.POST(request);
}
