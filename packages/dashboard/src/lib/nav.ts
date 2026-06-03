/**
 * Nav — single source of truth for the sidebar, mobile drawer, and ⌘K
 * command palette. Mirrors the four-group structure from the legacy
 * `packages/dashboard/src/components/layout/nav-config.ts`:
 *   - Platform
 *   - Infrastructure
 *   - Security & Ops
 *   - Admin
 *
 * In M1 only the dashboard, login, and logout routes are real. The
 * remaining items are scaffolded with a `M2+` badge so the sidebar
 * renders something to look at; the badge is removed when the page
 * lands.
 *
 * Permissions: `requiresAdmin: true` items are filtered out of the
 * sidebar for non-admin users in `Sidebar.svelte`. The server still
 * enforces the auth boundary.
 */

import type { Component } from 'svelte';
import LayoutDashboard from '$lib/icons/LayoutDashboard.svelte';
import Server from '$lib/icons/Server.svelte';
import Container from '$lib/icons/Container.svelte';
import Network from '$lib/icons/Network.svelte';
import HardDrive from '$lib/icons/HardDrive.svelte';
import Cpu from '$lib/icons/Cpu.svelte';
import Activity from '$lib/icons/Activity.svelte';
import AlertTriangle from '$lib/icons/AlertTriangle.svelte';
import ShieldCheck from '$lib/icons/ShieldCheck.svelte';
import FolderArchive from '$lib/icons/FolderArchive.svelte';
import Users from '$lib/icons/Users.svelte';
import KeyRound from '$lib/icons/KeyRound.svelte';
import ScrollText from '$lib/icons/ScrollText.svelte';
import GitBranch from '$lib/icons/GitBranch.svelte';
import Mail from '$lib/icons/Mail.svelte';
import Workflow from '$lib/icons/Workflow.svelte';
import BookOpenCheck from '$lib/icons/BookOpenCheck.svelte';
import TerminalSquare from '$lib/icons/TerminalSquare.svelte';
import PlugZap from '$lib/icons/PlugZap.svelte';

export type NavHref = string;

export interface NavItem {
	/** Stable id; also used as ⌘K index key. */
	id: string;
	/** Human-readable label (already i18n-resolved by the caller). */
	label: string;
	/** Path the user lands on. `null` ⇒ parent-only group heading. */
	href: NavHref | null;
	/** Inline-SVG icon component. */
	icon?: Component;
	/** Shortcut for the command palette, e.g. `g d` for "go to dashboard". */
	shortcut?: string;
	/** Keywords that boost the ⌘K fuzzy match. */
	keywords?: readonly string[];
	/** Hidden from the sidebar (still searchable in ⌘K). */
	hiddenInSidebar?: boolean;
	/** Server-enforced admin gate. Sidebar hides from non-admins. */
	requiresAdmin?: boolean;
	/** Workstream that ships the page; `null` = done. */
	workstream?: string | null;
}

export interface NavGroup {
	id: string;
	label: string;
	items: NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
	{
		id: 'platform',
		label: 'app.nav.platform',
		items: [
			{
				id: 'dashboard',
				label: 'app.nav.dashboard',
				href: '/dashboard',
				icon: LayoutDashboard,
				shortcut: 'g d',
				keywords: ['overview', 'home'],
				workstream: null,
			},
			{
				id: 'healthcheck',
				label: 'app.nav.healthcheck',
				href: '/healthcheck',
				icon: Activity,
				workstream: 'M1',
			},
			{
				id: 'apps',
				label: 'app.nav.apps',
				href: '/apps',
				icon: Workflow,
				workstream: 'M1',
			},
			{
				id: 'approvals',
				label: 'app.nav.approvals',
				href: '/approvals',
				icon: BookOpenCheck,
				workstream: 'M1',
			},
			{
				id: 'alerts',
				label: 'app.nav.alerts',
				href: '/alerts',
				icon: AlertTriangle,
				workstream: 'M1',
			},
		],
	},
	{
		id: 'infrastructure',
		label: 'app.nav.infrastructure',
		items: [
			{
				id: 'services',
				label: 'app.nav.services',
				href: '/services',
				icon: PlugZap,
				workstream: 'M1',
			},
			{
				id: 'docker',
				label: 'app.nav.docker',
				href: '/docker',
				icon: Container,
				workstream: 'M1',
			},
			{
				id: 'systemd',
				label: 'app.nav.systemd',
				href: '/systemd',
				icon: GitBranch,
				workstream: 'M1',
			},
			{
				id: 'incus',
				label: 'app.nav.incus',
				href: '/incus',
				icon: Server,
				workstream: 'M1',
			},
			{
				id: 'processes',
				label: 'app.nav.processes',
				href: '/processes',
				icon: Cpu,
				workstream: 'M1',
			},
			{
				id: 'network',
				label: 'app.nav.network',
				href: '/network',
				icon: Network,
				workstream: 'M1',
			},
			{
				id: 'storage',
				label: 'app.nav.storage',
				href: '/storage',
				icon: HardDrive,
				workstream: 'M1',
			},
			{
				id: 'scheduler',
				label: 'app.nav.scheduler',
				href: '/scheduler',
				icon: Activity,
				workstream: 'M1',
			},
			{
				id: 'backups',
				label: 'app.nav.backups',
				href: '/backups',
				icon: FolderArchive,
				workstream: 'M1',
			},
			{
				id: 'terminal',
				label: 'app.nav.terminal',
				href: '/terminal',
				icon: TerminalSquare,
				workstream: 'M1',
			},
		],
	},
	{
		id: 'security-ops',
		label: 'app.nav.securityOps',
		items: [
			{
				id: 'mail-guardian',
				label: 'Mail Guardian',
				href: null,
				icon: Mail,
				workstream: 'M2',
			},
			{
				id: 'audit',
				label: 'app.nav.audit',
				href: '/audit',
				icon: ScrollText,
				workstream: 'M1',
			},
		],
	},
	{
		id: 'admin',
		label: 'app.nav.admin',
		items: [
			{
				id: 'admin-users',
				label: 'Users',
				href: null,
				icon: Users,
				requiresAdmin: true,
				workstream: 'M2',
			},
			{
				id: 'admin-env',
				label: 'Env browser',
				href: null,
				icon: KeyRound,
				requiresAdmin: true,
				workstream: 'M2',
			},
			{
				id: 'admin-audit',
				label: 'Audit (admin)',
				href: null,
				icon: ShieldCheck,
				requiresAdmin: true,
				workstream: 'M2',
			},
		],
	},
] as const;

export function flattenNav(): readonly NavItem[] {
	return NAV_GROUPS.flatMap((group) => group.items);
}

export function filterByPermission(items: readonly NavItem[], isAdmin: boolean): NavItem[] {
	return items.filter((item) => (item.requiresAdmin ? isAdmin : true));
}
