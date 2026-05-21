#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const configPath = process.env.AGENTGATEWAY_MCP_CONFIG || "/opt/cortexos/agentgateway/mcp-servers.json";
const timeoutMs = Number(process.env.AGENTGATEWAY_MCP_TIMEOUT_MS || 120000);

function interpolate(value) {
  if (typeof value === "string") {
    return value.replace(/\$\{([^}]+)\}/g, (_match, key) => process.env[key] ?? "");
  }
  if (Array.isArray(value)) return value.map(interpolate);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolate(item)]));
  }
  return value;
}

function safeToolName(serverName, toolName) {
  return `${serverName}_${toolName}`.replace(/[^A-Za-z0-9_]/g, "_");
}

function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function buildTransport(name, cfg) {
  if (cfg.command) {
    return new StdioClientTransport({
      command: cfg.command,
      args: cfg.args || [],
      env: {
        PATH: process.env.PATH || "",
        HOME: process.env.HOME || "",
        USER: process.env.USER || "",
        ...cfg.env,
      },
      stderr: "inherit",
    });
  }
  if (cfg.url) {
    if (cfg.auth === "oauth") {
      throw new Error(`MCP server ${name} requires OAuth; complete OAuth support before enabling it in AgentGateway proxy`);
    }
    return new StreamableHTTPClientTransport(new URL(cfg.url), {
      requestInit: cfg.headers ? { headers: cfg.headers } : undefined,
    });
  }
  throw new Error(`MCP server ${name} must define command or url`);
}

async function connectDownstream(name, cfg) {
  const client = new Client({ name: `cortex-agentgateway-${name}`, version: "0.1.0" });
  await withTimeout(client.connect(buildTransport(name, cfg)), `${name} connect`);
  const listed = await withTimeout(client.listTools(), `${name} listTools`);
  return { name, cfg, client, tools: listed.tools || [] };
}

async function main() {
  const raw = JSON.parse(readFileSync(configPath, "utf8"));
  const servers = interpolate(raw.mcp_servers || raw);
  const downstreams = [];
  for (const [name, cfg] of Object.entries(servers)) {
    try {
      downstreams.push(await connectDownstream(name, cfg));
    } catch (error) {
      console.error(`[agentgateway-mcp] ${name}: ${error.message}`);
    }
  }

  const exposedTools = [];
  const toolMap = new Map();
  for (const downstream of downstreams) {
    for (const downstreamTool of downstream.tools) {
      const exposedName = safeToolName(downstream.name, downstreamTool.name);
      exposedTools.push({
        ...downstreamTool,
        name: exposedName,
        title: downstreamTool.title || exposedName,
        description: `[${downstream.name}] ${downstreamTool.description || downstreamTool.name}`,
      });
      toolMap.set(exposedName, { downstream, tool: downstreamTool });
    }
  }

  const gateway = new Server(
    { name: "cortex-agentgateway", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  gateway.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: exposedTools }));
  gateway.setRequestHandler(CallToolRequestSchema, async (request) => {
    const mapped = toolMap.get(request.params.name);
    if (!mapped) {
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown AgentGateway MCP tool: ${request.params.name}` }],
      };
    }
    return withTimeout(
      mapped.downstream.client.callTool({
        name: mapped.tool.name,
        arguments: request.params.arguments || {},
      }),
      `${request.params.name} callTool`,
    );
  });

  await gateway.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error(`[agentgateway-mcp] fatal: ${error.stack || error.message}`);
  process.exit(1);
});
