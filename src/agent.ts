/**
 * The shared shape of agent access: what an app's tools look like to an
 * agent (Claude through the MCP server at mcp.cornerways.io, and later the
 * built-in assistant), and the checks every tool call goes through.
 *
 * Server-only: import from "@cornerways/design/agent", never the package root.
 *
 * Each app exports an AgentTools WorkerEntrypoint that only the agent Worker
 * binds. The agent Worker passes just who is asking ({ memberId,
 * householdId }, from the OAuth grant); the app asks the hub itself what
 * that member may do in it now (checkMember), so a caller can never claim a
 * role. The tools run the same actions as the app's own routes, so an agent
 * can never do more than the person could in the app.
 */
import { isDevice, roleGate, type LiveSession } from "./auth.ts";

/** Who an agent is acting for, as the agent Worker knows it. */
export type AgentActor = { memberId: string; householdId: string };

/** The hub's answer to checkMember: the household-level role and scope now, and the member's role in the app named. */
export type MemberCheck = { household: LiveSession; app?: LiveSession };

/** Who a tool runs as: the member, with their effective role and scope in this app. */
export type AgentSession = { memberId: string; householdId: string; role: string; scope: string };

// ---------- Schemas ----------

/** The slice of JSON Schema tools use. Sent to agents as-is, and checked here before a tool runs. */
export type JsonSchema =
  | { type: "string"; description?: string; enum?: readonly string[]; format?: "date"; maxLength?: number }
  | { type: "number" | "integer"; description?: string; minimum?: number; maximum?: number }
  | { type: "boolean"; description?: string }
  | { type: "array"; description?: string; items: JsonSchema; minItems?: number; maxItems?: number }
  | ObjectSchema;

export type ObjectSchema = {
  type: "object";
  description?: string;
  properties: Record<string, JsonSchema>;
  required?: readonly string[];
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks a value against a schema and returns a clean copy (unknown object
 * keys dropped), or an error naming the first problem.
 */
export function validateArgs(schema: JsonSchema, value: unknown, path = "input"): { value: unknown } | { error: string } {
  switch (schema.type) {
    case "string": {
      if (typeof value !== "string") return { error: `${path} must be a string` };
      if (schema.enum && !schema.enum.includes(value)) return { error: `${path} must be one of ${schema.enum.join(", ")}` };
      if (schema.format === "date" && !DATE_ONLY.test(value)) return { error: `${path} must be a date (YYYY-MM-DD)` };
      if (schema.maxLength !== undefined && value.length > schema.maxLength) return { error: `${path} is too long` };
      return { value };
    }
    case "number":
    case "integer": {
      if (typeof value !== "number" || !Number.isFinite(value)) return { error: `${path} must be a number` };
      if (schema.type === "integer" && !Number.isInteger(value)) return { error: `${path} must be a whole number` };
      if (schema.minimum !== undefined && value < schema.minimum) return { error: `${path} must be at least ${schema.minimum}` };
      if (schema.maximum !== undefined && value > schema.maximum) return { error: `${path} must be at most ${schema.maximum}` };
      return { value };
    }
    case "boolean":
      return typeof value === "boolean" ? { value } : { error: `${path} must be true or false` };
    case "array": {
      if (!Array.isArray(value)) return { error: `${path} must be a list` };
      if (schema.minItems !== undefined && value.length < schema.minItems) return { error: `${path} needs at least ${schema.minItems}` };
      if (schema.maxItems !== undefined && value.length > schema.maxItems) return { error: `${path} allows at most ${schema.maxItems}` };
      const out: unknown[] = [];
      for (const [index, item] of value.entries()) {
        const checked = validateArgs(schema.items, item, `${path}[${index}]`);
        if ("error" in checked) return checked;
        out.push(checked.value);
      }
      return { value: out };
    }
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return { error: `${path} must be an object` };
      const record = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const key of schema.required ?? []) {
        if (record[key] === undefined || record[key] === null) return { error: `${path}.${key} is required` };
      }
      for (const [key, propertySchema] of Object.entries(schema.properties)) {
        if (record[key] === undefined || record[key] === null) continue;
        const checked = validateArgs(propertySchema, record[key], `${path}.${key}`);
        if ("error" in checked) return checked;
        out[key] = checked.value;
      }
      return { value: out };
    }
  }
}

// ---------- Tools ----------

/** What an agent sees of a tool. */
export type ToolSpec = {
  /** <app>_<verb>, e.g. "todo_add_items": unique across the family. */
  name: string;
  /** A short human title, shown in the agent's tool list. */
  title: string;
  /** What it does and when to use it, written for the model. */
  description: string;
  inputSchema: ObjectSchema;
  /** True if it never changes anything. Viewers only get read-only tools. */
  readOnly: boolean;
};

export type ToolErrorCode = "invalid" | "not_found" | "forbidden" | "no_access" | "internal";

/** Plain values rather than thrown errors: errors lose their type over RPC. */
export type ToolResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string; code: ToolErrorCode };

export function toolOk<T>(data: T): ToolResult<T> {
  return { ok: true, data };
}

export function toolError(code: ToolErrorCode, error: string): ToolResult<never> {
  return { ok: false, error, code };
}

/** A tool as an app defines it: the spec plus what it runs. */
export type AgentTool<Context> = ToolSpec & {
  run: (context: Context, args: any) => Promise<ToolResult>;
};

/** What every app's AgentTools entrypoint answers; the agent Worker's bindings use this type. */
export interface AgentToolsRpc {
  tools(actor: AgentActor): Promise<ToolSpec[]>;
  call(actor: AgentActor, name: string, args: unknown): Promise<ToolResult>;
}

/**
 * Who a tool call runs as, from the hub's live answer for this app. null
 * when they have no access here now: removed from the household, the app
 * not granted to them, or a paired device (devices can't connect agents).
 */
export async function resolveAgentSession(
  checkMember: (memberId: string, householdId: string, app: string) => Promise<MemberCheck | null>,
  actor: AgentActor,
  app: string,
): Promise<AgentSession | null> {
  if (isDevice(actor)) return null;
  const found = await checkMember(actor.memberId, actor.householdId, app);
  const effective = found?.app;
  if (!effective || effective.role === "none") return null;
  return { memberId: actor.memberId, householdId: actor.householdId, role: effective.role, scope: effective.scope };
}

function specOf<Context>(tool: AgentTool<Context>): ToolSpec {
  const { run: _run, ...spec } = tool;
  return spec;
}

/** The tools this person may use: none without access, read-only ones for a viewer. */
export function listAgentTools<Context>(tools: readonly AgentTool<Context>[], session: AgentSession | null): ToolSpec[] {
  if (!session) return [];
  return tools.filter((tool) => tool.readOnly || roleGate(session, "POST", { devices: "read-only" }) === null).map(specOf);
}

/**
 * Runs one tool call: access, role and arguments are checked here, so a
 * tool's own run only has the app's visibility and tagging rules to apply
 * (through the same actions its routes use).
 */
export async function runAgentTool<Context>(
  tools: readonly AgentTool<Context>[],
  session: AgentSession | null,
  name: string,
  args: unknown,
  context: (session: AgentSession) => Context,
): Promise<ToolResult> {
  if (!session) return toolError("no_access", "No access to this app");
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) return toolError("invalid", `Unknown tool: ${name}`);
  const denied = roleGate(session, tool.readOnly ? "GET" : "POST", { devices: "read-only" });
  if (denied) return toolError("forbidden", denied);
  const checked = validateArgs(tool.inputSchema, args ?? {});
  if ("error" in checked) return toolError("invalid", checked.error);
  try {
    return await tool.run(context(session), checked.value);
  } catch (err) {
    console.error(`agent tool ${name} failed`, err);
    return toolError("internal", "Something went wrong running that");
  }
}
