import { NextResponse, type NextRequest } from "next/server";
import { authenticate, fromError, presentJob } from "@/lib/api/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// The caller's recent jobs, newest first. Results are left out; fetch a job by id for those.
export async function GET(request: NextRequest) {
  try {
    const caller = await authenticate(request);
    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 20));
    const { data, error } = await supabaseAdmin().from("api_jobs").select("*").eq("org_id", caller.org_id).order("created_at", { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    const jobs = await Promise.all((data ?? []).map((j) => presentJob(j, false)));
    return NextResponse.json(
      { jobs, credits: { used: caller.credits_used, monthly: caller.monthly_credits } },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return fromError(err);
  }
}
