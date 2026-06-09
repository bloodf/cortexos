import { defineRoute } from '$lib/server/route-helper';
import { listAlertEvents } from '$lib/server/stub-data';
import type { AlertHistory } from '$lib/types/dashboard';

export const GET = defineRoute({
	methods: ['GET'],
	auth: 'any',
	surface: 'alerts',
	action: 'alerts.history',
	handler: async () => {
		const events = listAlertEvents();
		const alerts: AlertHistory[] = events
			.map((e) => ({
				id: e.id,
				ruleName: `Rule ${e.ruleId}`,
				status:
					e.status === 'firing' ? ('fired' as const) : e.status === 'resolved' ? ('resolved' as const) : ('info' as const),
				timestamp: e.firedAt,
			}))
			.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
		return { alerts };
	},
});
