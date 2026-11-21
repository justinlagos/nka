import { NextResponse, type NextRequest } from "next/server";
import { createRequest } from "@/lib/api/requests";
import { apiOrigin, fromError, keyHash, readJson } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const hash = keyHash(request);
    const body = await readJson(request);
    const result = await createRequest(hash, body, request.headers.get("idempotency-key")?.trim() || null, apiOrigin(request));
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (err) {
    return fromError(err);
  }
}
