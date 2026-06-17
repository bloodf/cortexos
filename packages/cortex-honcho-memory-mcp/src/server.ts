import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import pc from 'picocolors';
import { HonchoMemoryStore } from './honcho.js';
import { deriveWorkspaceName } from './workspace.js';

export interface ServerEnv {
  cwd: string;
  baseUrl: string;
  apiKey?: string;
}

export function createMcpServer(env: ServerEnv): McpServer {
  const store = new HonchoMemoryStore({
    cwd: env.cwd,
    baseUrl: env.baseUrl,
    apiKey: env.apiKey,
  });

  const server = new McpServer({
    name: 'cortex-honcho-memory',
    version: '0.1.0',
  });

  server.tool(
    'honcho_store_memory',
    'Persist a fact, preference, or observation about the current directory/project. The memory is scoped to the working directory, not global.',
    {
      content: z.string().min(1).max(4000).describe('The memory text to store.'),
      context: z
        .string()
        .max(1000)
        .optional()
        .describe('Optional short context label, e.g. "tech-stack" or "user-preference".'),
    },
    async ({ content, context }) => {
      const conclusion = await store.store(content, context);
      return {
        content: [
          {
            type: 'text',
            text: `Memory stored in workspace ${store.workspaceName}\nID: ${conclusion.id}\nCreated: ${conclusion.createdAt}`,
          },
        ],
      };
    },
  );

  server.tool(
    'honcho_recall_memory',
    'Search directory-scoped memory semantically. Returns the most relevant stored memories for the current project.',
    {
      query: z.string().min(1).max(1000).describe('The query or topic to recall.'),
      top_k: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe('Maximum number of memories to return (default 5).'),
    },
    async ({ query, top_k }) => {
      const results = await store.query(query, { topK: top_k });
      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No relevant memories found for this directory.',
            },
          ],
        };
      }
      const text = results
        .map((c, idx) => `[${idx + 1}] ${c.content}\nID: ${c.id} | Created: ${c.createdAt}`)
        .join('\n\n');
      return {
        content: [
          {
            type: 'text',
            text: `Recalled ${results.length} memory(s) from workspace ${store.workspaceName}:\n\n${text}`,
          },
        ],
      };
    },
  );

  server.tool(
    'honcho_list_memories',
    'List all stored memories for the current directory/project, newest first.',
    {
      page: z.number().int().min(1).optional().describe('Page number (default 1).'),
      page_size: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Items per page (default 50).'),
    },
    async ({ page, page_size }) => {
      const results = await store.list(page ?? 1, page_size ?? 50);
      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No memories stored for this directory yet.',
            },
          ],
        };
      }
      const text = results
        .map((c, idx) => `[${idx + 1}] ${c.content}\nID: ${c.id} | Created: ${c.createdAt}`)
        .join('\n\n');
      return {
        content: [
          {
            type: 'text',
            text: `Found ${results.length} memory(s) in workspace ${store.workspaceName}:\n\n${text}`,
          },
        ],
      };
    },
  );

  server.tool(
    'honcho_forget_memory',
    'Delete a specific memory by ID from the current directory/project.',
    {
      id: z.string().min(1).describe('The conclusion ID returned when the memory was stored.'),
    },
    async ({ id }) => {
      await store.delete(id);
      return {
        content: [
          {
            type: 'text',
            text: `Memory ${id} deleted from workspace ${store.workspaceName}.`,
          },
        ],
      };
    },
  );

  server.tool(
    'honcho_current_workspace',
    'Show the Honcho workspace name derived from the current working directory. Useful for confirming memory isolation between projects.',
    {},
    async () => {
      const name = deriveWorkspaceName(env.cwd);
      return {
        content: [
          {
            type: 'text',
            text: `Current directory: ${env.cwd}\nHoncho workspace: ${name}`,
          },
        ],
      };
    },
  );

  return server;
}

export async function runStdioServer(env: ServerEnv): Promise<void> {
  const server = createMcpServer(env);
  const transport = new StdioServerTransport();
  console.error(
    pc.gray(
      `[cortex-honcho-memory] workspace=${deriveWorkspaceName(env.cwd)} baseUrl=${env.baseUrl}`,
    ),
  );
  await server.connect(transport);
}
