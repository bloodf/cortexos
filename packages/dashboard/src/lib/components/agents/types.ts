/**
 * Agent component types — shared between the server loader and the UI.
 */

export type AgentRunState = 'running' | 'idle' | 'stopped' | 'error';
export type AgentHealth = 'healthy' | 'degraded' | 'down';

export interface AgentFile {
	path: string;
	language: string;
	content: string;
}

export interface AgentItem {
	slug: string;
	name: string;
	description: string;
	state: AgentRunState;
	model: string;
	modelProvider: string;
	health: AgentHealth;
	hermesUrl: string;
	version: string;
	uptimeSec: number;
	queueDepth: number;
	requestsPerMin: number;
	errorRatePct: number;
	p95LatencyMs: number;
	lastActivity: string;
	files: AgentFile[];
}
