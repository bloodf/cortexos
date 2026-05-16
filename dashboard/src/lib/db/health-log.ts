import { query, queryOne, execute } from "./client";

export interface HealthLogEntry {
	id: number;
	service_id: number;
	status: "online" | "offline" | "unknown";
	response_time_ms: number | null;
	checked_at: Date;
}

export interface UptimeStats {
	period: "24h" | "7d" | "30d";
	total_checks: number;
	online_checks: number;
	uptime_pct: number;
	avg_response_ms: number | null;
}

export interface IncidentTransition {
	from_status: string;
	to_status: string;
	changed_at: Date;
}

export async function insertHealthLog(
	serviceId: number,
	status: "online" | "offline" | "unknown",
	responseTimeMs?: number,
): Promise<HealthLogEntry> {
	const row = await queryOne<HealthLogEntry>(
		`INSERT INTO service_health_log (service_id, status, response_time_ms)
     VALUES ($1, $2, $3)
     RETURNING id, service_id, status, response_time_ms, checked_at`,
		[serviceId, status, responseTimeMs ?? null],
	);
	if (!row) throw new Error("Failed to insert health log");
	return row;
}

export async function getUptimeStats(
	serviceId: number,
	period: "24h" | "7d" | "30d",
): Promise<UptimeStats> {
	const hours = period === "24h" ? 24 : period === "7d" ? 168 : 720;
	const row = await queryOne<{
		total_checks: string;
		online_checks: string;
		avg_response_ms: string | null;
	}>(
		`SELECT
      COUNT(*) AS total_checks,
      COUNT(*) FILTER (WHERE status = 'online') AS online_checks,
      AVG(response_time_ms) FILTER (WHERE status = 'online') AS avg_response_ms
    FROM service_health_log
    WHERE service_id = $1 AND checked_at >= NOW() - INTERVAL '${hours} hours'`,
		[serviceId],
	);
	const total = parseInt(row?.total_checks ?? "0", 10);
	const online = parseInt(row?.online_checks ?? "0", 10);
	return {
		period,
		total_checks: total,
		online_checks: online,
		uptime_pct: total > 0 ? Math.round((online / total) * 1000) / 10 : 100,
		avg_response_ms: row?.avg_response_ms
			? Math.round(parseFloat(row.avg_response_ms))
			: null,
	};
}

export async function getIncidentTransitions(
	serviceId: number,
	limit: number = 50,
): Promise<IncidentTransition[]> {
	const rows = await query<{
		status: string;
		checked_at: Date;
	}>(
		`SELECT status, checked_at
     FROM service_health_log
     WHERE service_id = $1
     ORDER BY checked_at DESC
     LIMIT $2`,
		[serviceId, limit],
	);

	const transitions: IncidentTransition[] = [];
	for (let i = 0; i < rows.length - 1; i++) {
		const curr = rows[i];
		const next = rows[i + 1];
		if (curr.status !== next.status) {
			transitions.push({
				from_status: next.status,
				to_status: curr.status,
				changed_at: curr.checked_at,
			});
		}
	}
	return transitions;
}
