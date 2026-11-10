import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/origin";

// Signs out of this browser. "next" lets "use a different email" go straight back to sign-in.
export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  await supabase.auth.signOut({ scope: "local" });
  const form = await request.formData().catch(() => null);
  const next = safeNext(String(form?.get("next") ?? ""), "/");
  return NextResponse.redirect(new URL(next, request.url), { status: 303 });
}
