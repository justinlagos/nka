// A small Model Context Protocol server: JSON-RPC over HTTP POST, no sessions. It exposes the same
// five services as tools, so an agent can use Nka without writing any HTTP code.
import { ENDPOINTS, ON_REQUEST } from "./catalogue.ts";
import { requestSchema } from "./openapi.ts";
import { toJsonSchema } from "./schema.ts";

export const MCP_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

export type McpTools = {
  // Runs an endpoint to completion and returns the job as the API would.
  run: (endpointId: string, args: unknown) => Promise<unknown>;
  getJob: (id: string) => Promise<unknown>;
  listServices: () => unknown;
  requestService: (args: unknown) => Promise<unknown>;
};

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

export function toolList() {
  return [
    ...ENDPOINTS.map((e) => ({
      name: e.id,
      title: e.title,
      description: `${e.summary} Returns: ${e.returns} Costs ${e.units} credit${e.units === 1 ? "" : "s"}.`,
      inputSchema: toJsonSchema(e.input),
    })),
    {
      name: "get_job",
      title: "Get a job",
      description: "Fetches a job by id: its status, result and fresh links to its files.",
      inputSchema: { type: "object", properties: { id: { type: "string", description: "The job id." } }, required: ["id"], additionalProperties: false },
    },
    {
      name: "list_services",
      title: "List services",
      description: "Lists what Nka makes: the live services above and the on-request services handled by the studio team.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "request_service",
      title: "Request studio work",
      description: `Asks the Nka studio team for work that isn't automated yet. Creates a draft brief in the workspace for a person to send. Services: ${ON_REQUEST.map((s) => s.id).join(", ")}.`,
      inputSchema: toJsonSchema(requestSchema),
    },
  ];
}

const ok = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const fail = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

// Handles one message. Returns null for notifications, which get no reply.
export async function handleMcp(msg: Rpc, tools: McpTools): Promise<Record<string, unknown> | null> {
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(msg?.id, -32600, "Invalid request");
  const isNotification = msg.id === undefined;
  if (msg.method.startsWith("notifications/")) return null;
  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return ok(msg.id, {
        protocolVersion: MCP_VERSIONS.includes(asked) ? asked : MCP_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "nka", title: "Nka Studio", version: "1.0.0" },
        instructions: "Design work from Nka Studio. Every tool takes a brand (colours, typefaces, logo, or just a website). Tools return a job with a result and links to files; links last 24 hours.",
      });
    }
    case "ping":
      return ok(msg.id, {});
    case "tools/list":
      return ok(msg.id, { tools: toolList() });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = msg.params?.arguments ?? {};
      try {
        let out: unknown;
        if (name === "get_job") out = await tools.getJob(String((args as { id?: unknown }).id ?? ""));
        else if (name === "list_services") out = tools.listServices();
        else if (name === "request_service") out = await tools.requestService(args);
        else if (ENDPOINTS.some((e) => e.id === name)) out = await tools.run(name, args);
        else return fail(msg.id, -32602, `Unknown tool: ${name}`);
        const failed = Boolean(out && typeof out === "object" && (out as { status?: string }).status === "failed");
        return ok(msg.id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: out, isError: failed });
      } catch (err) {
        // Tool problems go back as a result the model can read and act on, not as a protocol error.
        const e = err as { code?: string; message?: string; details?: unknown };
        const body = { error: { code: e.code ?? "internal_error", message: e.code ? (e.message ?? "") : "Something went wrong.", ...(e.details ? { details: e.details } : {}) } };
        return ok(msg.id, { content: [{ type: "text", text: JSON.stringify(body, null, 2) }], structuredContent: body, isError: true });
      }
    }
    default:
      return isNotification ? null : fail(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}
