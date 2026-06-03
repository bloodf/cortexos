/**
 * Terminal entities: TerminalSession (server-internal), TerminalCommand.
 *
 * Source: `/api/terminal` POST (action=connect|exec|disconnect) and
 * the SSE stream `GET /api/terminal?sessionId=…`.
 *
 * The M0-A audit + M0-E threat model flag this as a full privileged
 * shell; Schneier must review the wiring (M3). The mock entities here
 * are the data shapes the UI consumes, not the policy surface.
 */

import { z } from 'zod';
import { asTerminalSessionId } from '../primitives';
import { TERMINAL_ACTIONS } from '../enums';

export const terminalCommandSchema = z.object({
	id: z.string().min(1),
	sessionId: z.string().min(1),
	command: z.string().min(1),
	startedAt: z.string().datetime(),
	finishedAt: z.string().datetime().nullable(),
	exitCode: z.number().int().optional(),
	stdout: z.string().default(''),
	stderr: z.string().default(''),
});
export type TerminalCommand = z.infer<typeof terminalCommandSchema>;

export const terminalSessionSchema = z.object({
	id: z.string().min(1),
	userId: z.string().min(1),
	connectedAt: z.string().datetime(),
	lastActivity: z.string().datetime(),
	connected: z.boolean(),
	cols: z.number().int().positive().default(80),
	rows: z.number().int().positive().default(24),
	shell: z.string().min(1),
	cwd: z.string().min(1),
});
export type TerminalSession = z.infer<typeof terminalSessionSchema> & {
	id: ReturnType<typeof asTerminalSessionId>;
};

export const terminalActionRequestSchema = z.object({
	action: z.enum(TERMINAL_ACTIONS),
	sessionId: z.string().min(1),
	data: z.string().optional(),
});
export type TerminalActionRequest = z.infer<typeof terminalActionRequestSchema>;

export const terminalOutputFrameSchema = z.object({
	output: z.string().optional(),
	error: z.string().optional(),
	exitCode: z.number().int().optional(),
});
export type TerminalOutputFrame = z.infer<typeof terminalOutputFrameSchema>;

export const brandTerminalSession = (
	s: z.infer<typeof terminalSessionSchema>,
): TerminalSession => ({ ...s, id: asTerminalSessionId(s.id) });
