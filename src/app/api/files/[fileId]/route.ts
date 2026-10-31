import { NextResponse } from "next/server";
import { pool } from "@/db";
import { readPrivateFileToken } from "@/lib/file-tokens";
import { privateStorage } from "@/modules/documents/private-storage";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await context.params;
  const token = new URL(request.url).searchParams.get("token");
  if (!token || !/^[0-9a-f-]{36}$/i.test(fileId)) return new Response(null, { status: 404 });
  try {
    if (await readPrivateFileToken(token) !== fileId) return new Response(null, { status: 404 });
    const row = await pool.query<{ storage_key: string; mime_type: string; original_name: string }>(
      "SELECT storage_key, mime_type, original_name FROM file_objects WHERE id = $1",
      [fileId],
    );
    if (!row.rowCount) return new Response(null, { status: 404 });
    const bytes = await privateStorage.read(row.rows[0]!.storage_key);
    const safeName = encodeURIComponent(row.rows[0]!.original_name.replace(/[\r\n\x00-\x1f\x7f]/g, ""));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": row.rows[0]!.mime_type,
        "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
