import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { setUpFromDemo } from "@/lib/demo-setup";

// Sign-in links from a demo request land here: build the workspace, then open it.
export async function GET(request: NextRequest) {
  const { userId } = await getSession();
  if (!userId) return NextResponse.redirect(new URL("/signin?next=/demo/ready", request.url));
  return NextResponse.redirect(new URL(await setUpFromDemo(), request.url));
}
