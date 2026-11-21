import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Called when a recipient taps to open their card.
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    const { error } = await supabaseAdmin().rpc("ecard_opened", { p_token: token });
    if (error) console.error("Card open not recorded", error.message);
  }
  return new NextResponse(null, { status: 204 });
}
