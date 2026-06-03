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
import Settings from '$lib/icons/Settings.svelte';
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
				workstream: null
			},
			{
				id: 'agents',
				label: 'Agents',
				href: null,
				icon: Workflow,
				workstream: 'M2'
			},
			{
				id: 'approvals',
				label: 'Approvals',
				href: null,
				icon: BookOpenCheck,
				workstream: 'M2'
			},
			{
				id: 'alerts',
				label: 'Alerts',
				href: null,
				icon: AlertTriangle,
				workstream: 'M2'
			}
		]
	},
	{
		id: 'infrastructure',
		label: 'app.nav.infrastructure',
		items: [
			{
				id: 'services',
				label: 'Services',
				href: null,
				icon: PlugZap,
				workstream: 'M2'
			},
			{
				id: 'docker',
				label: 'Docker',
				href: null,
				icon: Container,
				workstream: 'M2'
			},
			{
				id: 'systemd',
				label: 'systemd',
				href: null,
				icon: GitBranch,
				workstream: 'M2'
			},
			{
				id: 'incus',
				label: 'Incus',
				href: null,
				icon: Server,
				workstream: 'M2'
			},
			{
				id: 'processes',
				label: 'Processes',
				href: null,
				icon: Cpu,
				workstream: 'M2'
			},
			{
				id: 'network',
				label: 'Network',
				href: null,
				icon: Network,
				workstream: 'M2'
			},
			{
				id: 'storage',
				label: 'Storage',
				href: null,
				icon: HardDrive,
				workstream: 'M2'
			},
			{
				id: 'scheduler',
				label: 'Scheduler',
				href: null,
				icon: Activity,
				workstream: 'M2'
			},
			{
				id: 'backups',
				label: 'Backups',
				href: null,
				icon: FolderArchive,
				workstream: 'M2'
			},
			{
				id: 'terminal',
				label: 'Terminal',
				href: null,
				icon: TerminalSquare,
				workstream: 'M2'
			}
		]
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
				workstream: 'M2'
			},
			{
				id: 'audit',
				label: 'Audit log',
				href: null,
				icon: ScrollText,
				workstream: 'M2'
			}
		]
	},
	{
		id: 'admin',
		label: 'app.nav.admin',
		items: [
			{
				id: 'admin-services',
				label: 'Services (admin)',
				href: null,
				icon: Settings,
				requiresAdmin: true,
				workstream: 'M2'
			},
			{
				id: 'admin-users',
				label: 'Users',
				href: null,
				icon: Users,
				requiresAdmin: true,
				workstream: 'M2'
			},
			{
				id: 'admin-env',
				label: 'Env browser',
				href: null,
				icon: KeyRound,
				requiresAdmin: true,
				workstream: 'M2'
			},
			{
				id: 'admin-audit',
				label: 'Audit (admin)',
				href: null,
				icon: ShieldCheck,
				requiresAdmin: true,
				workstream: 'M2'
			}
		]
	}
] as const;

export function flattenNav(): readonly NavItem[] {
	return NAV_GROUPS.flatMap((group) => group.items);
}

export function filterByPermission(items: readonly NavItem[], isAdmin: boolean): NavItem[] {
	return items.filter((item) => (item.requiresAdmin ? isAdmin : true));
}
