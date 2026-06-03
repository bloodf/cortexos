/**
 * Canonical happy-path response builder — the source of truth for
 * what every route returns under the `happy` scenario.
 *
 * Scenarios wrap this. `empty` swaps arrays for `[]`, `error` swaps
 * the body for an error envelope, `slow` adds a delay, etc.
 *
 * Handlers and tests should never construct route payloads inline;
 * always call `getCanonicalResponse(ctx)` so the canonical shape
 * lives in exactly one place.
 */

import {
	makeService,
	makeAlertRule,
	makeAlertHistory,
	makeSystemData,
	makeNetworkData,
	makeProcessInfo,
	makeDockerContainer,
	makeDockerNetwork,
	makeIncusInstanceDb,
	makeIncusInstanceDetail,
	makeIncusImage,
	makeWizardDefaults,
	makeDashboardCommandAudit,
	makeAgent,
	makeEnvBrowserResponse,
	makeContainerList,
	makeImageList,
	makeVolumeList,
	makeIncusInstanceList,
	makeSystemdUnitList,
	makeAuditEventList,
	makeApprovalRequestList,
	makeBackupSnapshotList,
	makeSchedulerJobList,
	makePamUserList,
	makeBadgeList,
	makeProjectList,
	makeMailReviewList,
} from '../fixtures';
import { paginate, type PageInput } from '../contracts/query';
import type { ScenarioContext } from './types';

/**
 * Build the canonical response for a given (pathTemplate, method).
 *
 * The handler resolver in `../handlers/resolve.ts` calls this when
 * the active scenario is `happy`. The other scenarios either return
 * a derivative (empty/swapped) or a hard-coded error envelope.
 */
export function getCanonicalResponse(ctx: ScenarioContext): unknown {
	const { method, pathTemplate, pathParams } = ctx;
	const m = method.toUpperCase();

	// ── Auth ─────────────────────────────────────────────────────
	if (pathTemplate === '/api/auth' && m === 'POST') {
		const body = ctx.body as { username?: string; password?: string } | null;
		if (!body?.username || !body?.password) {
			return {
				code: 'VALIDATION_ERROR',
				message: 'Username and password required',
				fieldErrors: [{ path: ['username'], message: 'required' }],
			};
		}
		const isAdmin = body.username === 'admin' || body.username === 'alex';
		return { success: true, username: body.username, isAdmin };
	}
	if (pathTemplate === '/api/auth' && m === 'DELETE') {
		return { success: true };
	}
	if (pathTemplate === '/api/auth' && m === 'GET') {
		return { username: 'admin', isAdmin: true };
	}

	// ── Services ─────────────────────────────────────────────────
	if (pathTemplate === '/api/services' && m === 'GET') {
		const services = Array.from({ length: 8 }, () => makeService());
		return { services, timestamp: '2026-06-03T13:00:00.000Z' };
	}
	if (pathTemplate === '/api/services/[id]' && m === 'GET') {
		return { service: makeService({ slug: pathParams.id }) };
	}

	// ── System / host metrics ────────────────────────────────────
	if (pathTemplate === '/api/system' && m === 'GET') return makeSystemData();
	if (pathTemplate === '/api/network' && m === 'GET') return makeNetworkData();
	if (pathTemplate === '/api/processes' && m === 'GET') {
		const processes = Array.from({ length: 32 }, () => makeProcessInfo());
		return { processes };
	}

	// ── Docker ───────────────────────────────────────────────────
	if (pathTemplate === '/api/docker' && m === 'GET') {
		return {
			containers: { data: makeContainerList(5) },
			images: { data: makeImageList(8) },
			volumes: { data: makeVolumeList(3) },
		};
	}
	if (pathTemplate === '/api/docker/networks' && m === 'GET') {
		return { networks: Array.from({ length: 2 }, () => makeDockerNetwork()) };
	}
	if (pathTemplate === '/api/docker/actions' && m === 'POST') {
		return { stdout: 'ok', stderr: '' };
	}
	if (pathTemplate === '/api/docker/[id]' && m === 'GET') {
		return makeDockerContainer({ name: pathParams.id });
	}

	// ── Incus ────────────────────────────────────────────────────
	if (pathTemplate === '/api/incus/instances' && m === 'GET') {
		return { data: makeIncusInstanceList(4) };
	}
	if (pathTemplate === '/api/incus/instances' && m === 'POST') {
		const body = ctx.body as { config?: { target?: { slug?: string } } } | null;
		const slug = body?.config?.target?.slug ?? 'new-instance';
		return { data: makeIncusInstanceDb({ slug }), status: 201 };
	}
	if (pathTemplate === '/api/incus/instances/[name]' && m === 'GET') {
		// name is the branded IncusInstanceId in the schema; the
		// path param is a plain string, so the brand function inside
		// the factory re-brands it.
		return { data: makeIncusInstanceDetail({ name: pathParams.name as unknown as ReturnType<typeof makeIncusInstanceDetail>['name'] }) };
	}
	if (pathTemplate === '/api/incus/images' && m === 'GET') {
		return { data: Array.from({ length: 5 }, () => makeIncusImage()) };
	}
	if (pathTemplate === '/api/incus/settings' && m === 'GET') {
		return { data: { defaults: makeWizardDefaults(), model: 'qwen2.5-coder:7b' } };
	}
	if (pathTemplate === '/api/incus/actions' && m === 'POST') {
		return { stdout: 'ok', stderr: '' };
	}
	if (pathTemplate === '/api/incus/[name]/shell' && m === 'POST') {
		return { stdout: 'Linux cortex 6.6.0 x86_64', stderr: '', exitCode: 0 };
	}

	// ── Systemd ─────────────────────────────────────────────────
	if (pathTemplate === '/api/systemd' && m === 'GET') {
		return { services: makeSystemdUnitList(5) };
	}
	if (pathTemplate === '/api/systemd/actions' && m === 'POST') {
		return { stdout: 'ok', stderr: '' };
	}

	// ── Alerts ──────────────────────────────────────────────────
	if (pathTemplate === '/api/alerts' && m === 'GET') {
		if (ctx.url.searchParams.get('history') === '1') {
			return { history: Array.from({ length: 5 }, () => makeAlertHistory()) };
		}
		return { rules: Array.from({ length: 3 }, () => makeAlertRule()) };
	}
	if (pathTemplate === '/api/alerts' && m === 'POST') {
		return { rule: makeAlertRule(), status: 201 };
	}
	if (pathTemplate === '/api/alerts/[id]' && m === 'PATCH') {
		return { rule: makeAlertRule() };
	}
	if (pathTemplate === '/api/alerts/[id]' && m === 'DELETE') {
		return { success: true };
	}

	// ── Audit ───────────────────────────────────────────────────
	if (pathTemplate === '/api/audit' && m === 'GET') {
		return {
			rows: makeAuditEventList(20),
			total: 20,
		};
	}
	if (pathTemplate === '/api/audit/verify' && m === 'GET') {
		return { ok: true, brokenAt: null, total: 20 };
	}
	if (pathTemplate === '/api/dashboard_command_audit' && m === 'GET') {
		return {
			rows: Array.from({ length: 5 }, () => makeDashboardCommandAudit()),
			total: 5,
		};
	}
	if (pathTemplate === '/api/dashboard_command_audit' && m === 'POST') {
		return { dca: makeDashboardCommandAudit(), status: 201 };
	}

	// ── Approvals ───────────────────────────────────────────────
	if (pathTemplate === '/api/approvals' && m === 'GET') {
		return { approvals: makeApprovalRequestList(3) };
	}
	if (pathTemplate === '/api/approvals' && m === 'POST') {
		return { success: true };
	}

	// ── Admin: users / badges / projects / agents / mail ───────
	if (pathTemplate === '/api/admin/users' && m === 'GET') {
		return { users: makePamUserList(4) };
	}
	if (pathTemplate === '/api/badges' && m === 'GET') {
		return { badges: makeBadgeList(5) };
	}
	if (pathTemplate === '/api/projects' && m === 'GET') {
		return { projects: makeProjectList(3) };
	}
	if (pathTemplate === '/api/agents' && m === 'GET') {
		return {
			groups: [
				{ project: 'cortexos', agents: Array.from({ length: 2 }, () => makeAgent()) },
			],
			timestamp: '2026-06-03T13:00:00.000Z',
		};
	}
	if (pathTemplate === '/api/mail-guardian/reviews' && m === 'GET') {
		return { reviews: makeMailReviewList(4) };
	}

	// ── Backups / scheduler ────────────────────────────────────
	if (pathTemplate === '/api/backups' && m === 'GET') {
		return { backups: makeBackupSnapshotList(3) };
	}
	if (pathTemplate === '/api/scheduler' && m === 'GET') {
		return { jobs: makeSchedulerJobList(3) };
	}

	// ── Env-browser ────────────────────────────────────────────
	if (pathTemplate === '/api/env-browser' && m === 'GET') {
		return makeEnvBrowserResponse();
	}

	// ── Generic healthcheck ────────────────────────────────────
	if (pathTemplate === '/api/health' && m === 'GET') {
		return { status: 'ok', timestamp: '2026-06-03T13:00:00.000Z' };
	}

	// Default: paginated wrapper for list endpoints
	if (m === 'GET') {
		const input: PageInput = {
			page: Number(ctx.url.searchParams.get('page') ?? '1'),
			pageSize: Number(ctx.url.searchParams.get('pageSize') ?? '50'),
			search: ctx.url.searchParams.get('search') ?? undefined,
			sortBy: ctx.url.searchParams.get('sortBy') ?? undefined,
			sortDir:
				(ctx.url.searchParams.get('sortDir') as 'asc' | 'desc' | null) ?? 'asc',
		};
		return paginate([], input);
	}

	return { ok: true, method: m, path: pathTemplate };
}

// Re-export the pageInputSchema from query so handlers can re-parse.
export { pageInputSchema, type PageInput, paginate, type Page } from '../contracts/query';
