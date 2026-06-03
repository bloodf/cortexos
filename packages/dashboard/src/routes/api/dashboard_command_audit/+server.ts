/**
 * /api/dashboard_command_audit — two-phase lifecycle (THREAT_MODEL §6.1 + SR-090).
 *
 * M1 implementation: INSERT 'created' → UPDATE 'finished'. The two-phase
 * model is preserved exactly as the production table will require; only
 * the persistence is in-memory.
 *
 * Per SR-090, the UPDATE is permitted but only on `status`, `output`,
 * `finishedAt`, `errorCode`. The original `createdAt` + `requestedBy`
 * + `command` are immutable. The `advanceCommandAudit` helper enforces
 * this by only accepting patches for the allowed fields.
 */

import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import {
  advanceCommandAudit,
  createCommandAudit,
  getCommandAudit,
  listCommandAudits,
} from '$lib/server/stub-data';
import { notFoundError, approvalRequiredError } from '$lib/server/errors/types';

const CreateInput = z.object({
  command: z.string().min(1).max(2000),
  target: z.string().max(256).nullable().optional(),
  requestId: z.string().min(1).max(128),
});

const UpdateInput = z.object({
  status: z.enum(['running', 'finished', 'failed', 'cancelled']),
  output: z.string().max(64_000).nullable().optional(),
  errorCode: z.string().max(64).nullable().optional(),
});

export const GET = defineRoute({
  methods: ['GET'],
  auth: 'admin',
  surface: 'dashboard_command_audit',
  action: 'command_audit.list',
  rateLimit: { limit: 30, windowSec: 60, bucket: 'user' },
  handler: async () => {
    return { items: listCommandAudits() };
  },
});

export const POST = defineRoute({
  methods: ['POST'],
  input: CreateInput,
  auth: 'admin',
  surface: 'dashboard_command_audit',
  action: 'command_audit.create',
  target: (i) => i.requestId,
  rateLimit: { limit: 10, windowSec: 60, bucket: 'user' },
  handler: async ({ user, input }) => {
    // Privileged commands (e.g. systemd.restart) require an approval token.
    if (input.command.startsWith('systemd.') || input.command.startsWith('incus.delete')) {
      throw approvalRequiredError(`command_audit.${input.command}`, 60);
    }
    const row = createCommandAudit({
      requestId: input.requestId,
      requestedBy: user.id,
      command: input.command,
      target: input.target ?? null,
    });
    return { item: row };
  },
});

/**
 * PATCH /api/dashboard_command_audit?id=...
 *
 * Two-phase advance: 'running' → 'finished' | 'failed' | 'cancelled'.
 * Per SR-090, only allowed fields may be patched; the stub-data layer
 * enforces this.
 */
export const PATCH = defineRoute({
  methods: ['PATCH'],
  input: UpdateInput,
  auth: 'admin',
  surface: 'dashboard_command_audit',
  action: 'command_audit.update',
  target: (i) => String(i),
  rateLimit: { limit: 30, windowSec: 60, bucket: 'user' },
  handler: async ({ event, input }) => {
    const id = event.url.searchParams.get('id') ?? '';
    if (!id) throw notFoundError('id query param required', 'command_audit');
    const cur = getCommandAudit(id);
    if (!cur) throw notFoundError(`Command audit ${id} not found`, 'command_audit');
    const patch: Parameters<typeof advanceCommandAudit>[1] = {
      status: input.status,
      ...(input.output !== undefined ? { output: input.output } : {}),
      ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
    };
    if (input.status === 'finished' || input.status === 'failed' || input.status === 'cancelled') {
      patch.finishedAt = new Date().toISOString();
    }
    const next = advanceCommandAudit(id, patch);
    if (!next) throw notFoundError(`Command audit ${id} not found`, 'command_audit');
    return { item: next };
  },
});
