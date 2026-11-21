// A small subset of JSON Schema. Each endpoint's input is described once, here, and that one
// description validates requests, fills the OpenAPI document and tells MCP clients what to send.

export type Schema =
  | { type: "string"; description?: string; enum?: readonly string[]; minLength?: number; maxLength?: number; pattern?: string; format?: "uri" | "date" | "hex-colour"; default?: string; examples?: string[] }
  | { type: "number" | "integer"; description?: string; minimum?: number; maximum?: number; default?: number }
  | { type: "boolean"; description?: string; default?: boolean }
  | { type: "array"; description?: string; items: Schema; minItems?: number; maxItems?: number }
  | { type: "object"; description?: string; properties: Record<string, Schema>; required?: readonly string[]; additionalProperties?: boolean | Schema };

export type Issue = { path: string; message: string };

const HEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function check(schema: Schema, value: unknown, path: string, out: Issue[]): unknown {
  const at = path || "body";
  if (out.length >= 20) return value;
  switch (schema.type) {
    case "string": {
      if (typeof value !== "string") {
        out.push({ path: at, message: "must be a string" });
        return value;
      }
      const v = value.trim();
      if (schema.enum && !schema.enum.includes(v)) out.push({ path: at, message: `must be one of: ${schema.enum.join(", ")}` });
      if (schema.minLength !== undefined && v.length < schema.minLength) out.push({ path: at, message: schema.minLength === 1 ? "must not be empty" : `must be at least ${schema.minLength} characters` });
      if (schema.maxLength !== undefined && v.length > schema.maxLength) out.push({ path: at, message: `must be at most ${schema.maxLength} characters` });
      if (schema.pattern && !new RegExp(schema.pattern).test(v)) out.push({ path: at, message: "is not in the expected format" });
      if (schema.format === "uri" && !isHttpUrl(v)) out.push({ path: at, message: "must be an http(s) URL" });
      if (schema.format === "date" && !DATE.test(v)) out.push({ path: at, message: "must be a date, YYYY-MM-DD" });
      if (schema.format === "hex-colour" && !HEX.test(v)) out.push({ path: at, message: "must be a hex colour, e.g. #1a1b3a" });
      return v;
    }
    case "number":
    case "integer": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        out.push({ path: at, message: "must be a number" });
        return value;
      }
      if (schema.type === "integer" && !Number.isInteger(value)) out.push({ path: at, message: "must be a whole number" });
      if (schema.minimum !== undefined && value < schema.minimum) out.push({ path: at, message: `must be ${schema.minimum} or more` });
      if (schema.maximum !== undefined && value > schema.maximum) out.push({ path: at, message: `must be ${schema.maximum} or less` });
      return value;
    }
    case "boolean":
      if (typeof value !== "boolean") out.push({ path: at, message: "must be true or false" });
      return value;
    case "array": {
      if (!Array.isArray(value)) {
        out.push({ path: at, message: "must be a list" });
        return value;
      }
      if (schema.minItems !== undefined && value.length < schema.minItems) out.push({ path: at, message: `needs at least ${schema.minItems} item${schema.minItems === 1 ? "" : "s"}` });
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        out.push({ path: at, message: `takes at most ${schema.maxItems} items` });
        return value;
      }
      return value.map((v, i) => check(schema.items, v, `${path}[${i}]`, out));
    }
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        out.push({ path: at, message: "must be an object" });
        return value;
      }
      const src = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const key of schema.required ?? []) {
        if (src[key] === undefined || src[key] === null) out.push({ path: path ? `${path}.${key}` : key, message: "is required" });
      }
      for (const [key, v] of Object.entries(src)) {
        if (v === undefined || v === null) continue;
        const child = schema.properties[key];
        const where = path ? `${path}.${key}` : key;
        if (child) result[key] = check(child, v, where, out);
        else if (schema.additionalProperties && typeof schema.additionalProperties === "object") result[key] = check(schema.additionalProperties, v, where, out);
        else if (schema.additionalProperties === true) result[key] = v;
        else out.push({ path: where, message: "is not a known field" });
      }
      for (const [key, child] of Object.entries(schema.properties)) {
        if (result[key] === undefined && "default" in child && child.default !== undefined) result[key] = child.default;
      }
      return result;
    }
  }
}

// Returns the cleaned value (strings trimmed, defaults filled) or the list of problems.
export function validate<T>(schema: Schema, value: unknown): { ok: true; value: T } | { ok: false; issues: Issue[] } {
  const issues: Issue[] = [];
  const cleaned = check(schema, value, "", issues);
  return issues.length ? { ok: false, issues } : { ok: true, value: cleaned as T };
}

// The same schema as plain JSON Schema, for OpenAPI and MCP. "hex-colour" isn't a standard format,
// so it becomes a pattern.
export function toJsonSchema(schema: Schema): Record<string, unknown> {
  const s = schema as Record<string, unknown> & Schema;
  const base: Record<string, unknown> = { ...s };
  if (schema.type === "string" && schema.format === "hex-colour") {
    delete base.format;
    base.pattern = HEX.source;
  }
  if (schema.type === "array") base.items = toJsonSchema(schema.items);
  if (schema.type === "object") {
    base.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, toJsonSchema(v)]));
    base.additionalProperties =
      schema.additionalProperties && typeof schema.additionalProperties === "object"
        ? toJsonSchema(schema.additionalProperties)
        : schema.additionalProperties === true;
    if (schema.required) base.required = [...schema.required];
  }
  if ("enum" in base && base.enum) base.enum = [...(base.enum as string[])];
  return base;
}
