import { NextResponse } from "next/server";
import { authenticate, findJob, fromError } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await authenticate(request);
    const { id } = await params;
    return NextResponse.json(await findJob(caller, id), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return fromError(err);
  }
}
