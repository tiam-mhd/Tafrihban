import { toNextJsHandler } from "better-auth/next-js";
import { operationalAuth } from "@/lib/auth";

const handlers = toNextJsHandler(operationalAuth);
function blocked(request: Request) { return /\/sign-up(?:\/|$)/.test(new URL(request.url).pathname); }
export async function GET(request: Request) { return blocked(request) ? new Response(null, { status: 404 }) : handlers.GET(request); }
export async function POST(request: Request) { return blocked(request) ? new Response(null, { status: 404 }) : handlers.POST(request); }
