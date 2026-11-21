import { NextResponse } from "next/server";
import { catalogue } from "@/lib/api/catalogue";
import { apiOrigin } from "@/lib/api/server";

export const dynamic = "force-dynamic";

// The catalogue: what runs now, what the studio does on request, and where the docs are. No key needed.
export function GET(request: Request) {
  return NextResponse.json(catalogue(apiOrigin(request)), { headers: { "cache-control": "public, max-age=300" } });
}
