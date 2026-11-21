import { NextResponse } from "next/server";
import { authenticate, fromError } from "@/lib/api/server";
import { ApiError } from "@/lib/api/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Open counts for one card: totals, and each recipient by name and the caller's own reference.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await authenticate(request);
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "No such card.");
    const db = supabaseAdmin();
    const { data: card } = await db.from("ecards").select("id, created_at, expires_at").eq("id", id).eq("org_id", caller.org_id).maybeSingle();
    if (!card) throw new ApiError(404, "not_found", "No such card.");
    const { data: people, error } = await db.from("ecard_recipients").select("name, ref, opens, first_opened_at, last_opened_at").eq("ecard_id", id).order("name").limit(1000);
    if (error) throw new Error(error.message);
    const list = people ?? [];
    const opened = list.filter((p) => p.opens > 0).length;
    return NextResponse.json(
      {
        card_id: card.id,
        created_at: card.created_at,
        expires_at: card.expires_at,
        recipients: list.length,
        opened,
        open_rate: list.length ? Math.round((opened / list.length) * 1000) / 1000 : 0,
        total_opens: list.reduce((t, p) => t + p.opens, 0),
        people: list,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return fromError(err);
  }
}
