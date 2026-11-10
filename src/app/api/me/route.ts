import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Who is signed in on this browser right now. Open tabs check it so a tab never keeps
// showing one account after another account signed in elsewhere in the same browser.
export async function GET() {
  const { userId } = await getSession();
  return NextResponse.json({ id: userId }, { headers: { "cache-control": "no-store" } });
}
