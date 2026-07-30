import { randomUUID } from "node:crypto";

const MCP_URL = "https://api.paybox.sh/mcp";
const PROTOCOL_VERSION = "2025-06-18";

type JsonRpcResponse = {
  id?: string | number;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

async function responseJson(response: Response): Promise<JsonRpcResponse | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    return JSON.parse(text) as JsonRpcResponse;
  }
  const messages = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]")
    .map((line) => JSON.parse(line) as JsonRpcResponse);
  return messages.find((message) => message.result || message.error) ?? null;
}

export class PayboxMcpClient {
  private sessionId: string | null = null;

  constructor(private readonly accessToken: string) {}

  private async post(body: Record<string, unknown>) {
    const response = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.accessToken}`,
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        ...(this.sessionId ? { "mcp-session-id": this.sessionId } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const nextSessionId = response.headers.get("mcp-session-id");
    if (nextSessionId) this.sessionId = nextSessionId;
    const message = await responseJson(response);
    if (!response.ok || message?.error) {
      throw new Error(message?.error?.message ?? `Paybox MCP request failed (${response.status}).`);
    }
    return message?.result;
  }

  async initialize() {
    await this.post({
      jsonrpc: "2.0",
      id: randomUUID(),
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "five-minute-bitcoin", version: "0.1.0" },
      },
    });
    await this.post({ jsonrpc: "2.0", method: "notifications/initialized" });
  }

  async listTools() {
    return this.post({
      jsonrpc: "2.0",
      id: randomUUID(),
      method: "tools/list",
      params: {},
    });
  }

  async readResource(uri: string) {
    return this.post({
      jsonrpc: "2.0",
      id: randomUUID(),
      method: "resources/read",
      params: { uri },
    });
  }

  async callToolRaw(name: string, args: Record<string, unknown> = {}) {
    const result = (await this.post({
      jsonrpc: "2.0",
      id: randomUUID(),
      method: "tools/call",
      params: { name, arguments: args },
    })) as {
      content?: Array<{ type: string; text?: string }>;
      structuredContent?: unknown;
      isError?: boolean;
    };
    if (result?.isError) {
      throw new Error(result.content?.find((item) => item.type === "text")?.text ?? "Paybox tool failed.");
    }
    return result;
  }

  async callTool(name: string, args: Record<string, unknown> = {}) {
    const result = await this.callToolRaw(name, args);
    if (result?.structuredContent) return result.structuredContent;
    const text = result?.content?.find((item) => item.type === "text")?.text;
    if (!text) return result;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { text };
    }
  }
}
