import { Honcho } from '@honcho-ai/sdk';
import type { Conclusion } from '@honcho-ai/sdk';
import { deriveWorkspaceName } from './workspace.js';

const PEER_ID = 'user';

export interface HonchoEnv {
  baseUrl: string;
  apiKey?: string;
  cwd: string;
}

export class HonchoMemoryStore {
  private client: Honcho;

  private workspaceId: string;

  constructor(env: HonchoEnv) {
    this.client = new Honcho({
      baseURL: env.baseUrl,
      apiKey: env.apiKey,
      timeout: 30_000,
      workspaceId: deriveWorkspaceName(env.cwd),
    });
    this.workspaceId = this.client.workspaceId;
  }

  get workspaceName(): string {
    return this.workspaceId;
  }

  async store(content: string, _context?: string): Promise<Conclusion> {
    const peer = await this.client.peer(PEER_ID);
    const conclusions = await peer.conclusions.create({ content });
    if (!conclusions.length) {
      throw new Error('Honcho did not return a created conclusion');
    }
    return conclusions[0];
  }

  async list(page = 1, pageSize = 50): Promise<Conclusion[]> {
    const peer = await this.client.peer(PEER_ID);
    const response = await peer.conclusions.list({ page, size: pageSize });
    return response.items ?? [];
  }

  async query(
    query: string,
    options: { topK?: number; filters?: Record<string, unknown> } = {},
  ): Promise<Conclusion[]> {
    const peer = await this.client.peer(PEER_ID);
    return peer.conclusions.query(query, options.topK);
  }

  async delete(conclusionId: string): Promise<void> {
    const peer = await this.client.peer(PEER_ID);
    await peer.conclusions.delete(conclusionId);
  }
}
