import type { NextRequest } from "next/server";
import { handleRun } from "@/lib/api/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export function POST(request: NextRequest) {
  return handleRun(request, "documents");
}
