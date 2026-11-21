import { NextResponse, type NextRequest } from "next/server";
import { catalogue, endpointById } from "@/lib/api/catalogue";
import { handleMcp, type McpTools } from "@/lib/api/mcp";
import { createRequest } from "@/lib/api/requests";
import { apiOrigin, authenticate, errorResponse, findJob, fromError, keyHash, presentJob, readJson, runJob, startJob } from "@/lib/api/server";
import { ApiError } from "@/lib/api/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Model Context Protocol over plain HTTP POST. Stateless: every message carries the API key.
// Point an MCP client at this address with the header "Authorization: Bearer nka_live_...".
export async function POST(request: NextRequest) {
  try {
    const caller = await authenticate(request);
    const hash = keyHash(request);
    const origin = apiOrigin(request);
    const body = await readJson(request);
    const tools: McpTools = {
      run: async (id, args) => {
        const endpoint = endpointById(id);
        if (!endpoint) throw new ApiError(404, "not_found", "No such tool.");
        const { job, replayed } = await startJob(request, endpoint, args);
        return presentJob(replayed ? job : ((await runJob(job.id, origin)) ?? job));
      },
      getJob: (id) => findJob(caller, id),
      listServices: () => catalogue(origin),
      requestService: (args) => createRequest(hash, args, null, origin),
    };
    if (Array.isArray(body)) {
      if (body.length === 0 || body.length > 20) return errorResponse(400, "invalid_request", "Send between 1 and 20 messages.");
      const replies = (await Promise.all(body.map((m) => handleMcp(m, tools)))).filter(Boolean);
      return replies.length ? NextResponse.json(replies, { headers: { "cache-control": "no-store" } }) : new NextResponse(null, { status: 202 });
    }
    const reply = await handleMcp(body as never, tools);
    return reply ? NextResponse.json(reply, { headers: { "cache-control": "no-store" } }) : new NextResponse(null, { status: 202 });
  } catch (err) {
    const res = fromError(err);
    if (err instanceof ApiError && err.status === 401) res.headers.set("www-authenticate", 'Bearer realm="nka"');
    return res;
  }
}

// No server-to-client stream is offered.
export function GET() {
  return new NextResponse(null, { status: 405, headers: { allow: "POST" } });
}
