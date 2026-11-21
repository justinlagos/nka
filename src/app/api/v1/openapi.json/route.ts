import { NextResponse } from "next/server";
import { openapi } from "@/lib/api/openapi";
import { apiOrigin } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return NextResponse.json(openapi(apiOrigin(request)), { headers: { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
}
