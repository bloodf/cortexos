import { query, queryOne, execute } from "./client";

export type MessagingPlatform =
	| "telegram"
	| "slack"
	| "discord"
	| "whatsapp"
	| "signal"
	| "sms"
	| "email"
	| "matrix"
	| "mattermost"
	| "teams"
	| "line"
	| "viber"
	| "wechat"
	| "webhook";

const PLATFORMS: ReadonlySet<MessagingPlatform> = new Set([
	"telegram",
	"slack",
	"discord",
	"whatsapp",
	"signal",
	"sms",
	"email",
	"matrix",
	"mattermost",
	"teams",
	"line",
	"viber",
	"wechat",
	"webhook",
]);

export interface MessagingRoute {
	id: number;
	project_id: number;
	platform: MessagingPlatform;
	account_ref: string;
	route_config: Record<string, unknown>;
	approval_gates: string[];
	created_at: Date;
}

export interface AddRouteInput {
	project_id: number;
	platform: MessagingPlatform;
	account_ref: string;
	route_config?: Record<string, unknown>;
	approval_gates?: string[];
}

const COLUMNS =
	"id, project_id, platform, account_ref, route_config, approval_gates, created_at";

function validatePlatform(p: string): asserts p is MessagingPlatform {
	if (!PLATFORMS.has(p as MessagingPlatform)) {
		throw new Error(`Invalid messaging platform: ${p}`);
	}
}

function validateAccountRef(ref: string): void {
	if (!ref || ref.length > 128) {
		throw new Error("account_ref must be 1..128 chars");
	}
}

export async function listRoutes(
	projectId?: number,
): Promise<MessagingRoute[]> {
	if (projectId !== undefined) {
		return query<MessagingRoute>(
			`SELECT ${COLUMNS} FROM messaging_routes WHERE project_id = $1 ORDER BY platform, id`,
			[projectId],
		);
	}
	return query<MessagingRoute>(
		`SELECT ${COLUMNS} FROM messaging_routes ORDER BY project_id, platform, id`,
	);
}

export async function addRoute(input: AddRouteInput): Promise<MessagingRoute> {
	validatePlatform(input.platform);
	validateAccountRef(input.account_ref);
	if (!Number.isInteger(input.project_id) || input.project_id <= 0) {
		throw new Error("project_id must be a positive integer");
	}
	const gates = input.approval_gates ?? [];
	if (!Array.isArray(gates)) {
		throw new Error("approval_gates must be an array of strings");
	}
	const row = await queryOne<MessagingRoute>(
		`INSERT INTO messaging_routes (project_id, platform, account_ref, route_config, approval_gates)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING ${COLUMNS}`,
		[
			input.project_id,
			input.platform,
			input.account_ref,
			JSON.stringify(input.route_config ?? {}),
			gates,
		],
	);
	if (!row) throw new Error("Failed to add messaging route");
	return row;
}

export async function removeRoute(id: number): Promise<void> {
	await execute("DELETE FROM messaging_routes WHERE id = $1", [id]);
}
