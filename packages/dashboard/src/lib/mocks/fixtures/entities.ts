/**
 * System, Docker, Incus, systemd, terminal, audit, approvals, badges,
 * projects, agents, mail, backups, scheduler, notifications, env,
 * logs, AI, dashboard-prefs factories.
 *
 * All factories share the deterministic seed set in `./seed.ts`.
 * Every factory return is a Zod-parseable plain object.
 */

import { faker } from '@faker-js/faker';
import { FROZEN_NOW, FROZEN_NOW_EPOCH, nextIdValue } from './seed';
import { makePamUser as _makePamUser } from './auth-service';
import {
	type SystemData,
	type DriveInfo,
	type MountInfo,
	type MachineSensor,
	type ProcessInfo,
	type NetworkInterface,
	type NetworkData,
	brandDockerContainer,
	brandDockerImage,
	brandDockerVolume,
	brandDockerNetwork,
	type DockerContainer,
	type DockerImage,
	type DockerVolume,
	type DockerNetwork,
	brandIncusInstanceDb,
	brandIncusInstanceDetail,
	brandIncusImage,
	type IncusInstanceDb,
	type IncusInstanceDetail,
	type IncusImage,
	type IncusInstanceConfig,
	type WizardDefaults,
	type IncusPreflightReport,
	type ProgressStep,
	type IncusShellResult,
	brandSystemdUnit,
	type SystemdUnit,
	brandTerminalSession,
	type TerminalSession,
	type TerminalCommand,
	brandAuditEvent,
	brandDashboardCommandAudit,
	type AuditEvent,
	type DashboardCommandAudit,
	brandApprovalRequest,
	type ApprovalRequest,
	brandBadge,
	brandProject,
	brandAgent,
	brandMailReview,
	type Badge,
	type Project,
	type Agent,
	type MailReview,
	brandBackupSnapshot,
	brandSchedulerJob,
	brandNotification,
	brandLogEntry,
	brandAIRequest,
	brandAIResponse,
	brandAppPreference,
	brandWidgetConfig,
	brandDashboardLayout,
	type BackupSnapshot,
	type SchedulerJob,
	type NotificationEntry,
	type LogEntry,
	type AIRequest,
	type AIResponse,
	type AppPreference,
	type WidgetConfig,
	type DashboardLayout,
	type EnvLine,
	type EnvBrowserResponse,
	asEnvVarName,
	asIncusInstanceId,
} from '../contracts';
import { DOCKER_STATES, INCUS_INSTANCE_TYPES, SYSTEMD_ACTIVE_STATES, SYSTEMD_LOAD_STATES } from '../contracts/enums';

let _unused = 0; // placeholder, no longer used
const nextId = (prefix: string) =>
	`${prefix}_${nextIdValue().toString().padStart(4, '0')}`;

// ─── System ────────────────────────────────────────────────────────
export const makeDriveInfo = (overrides: Partial<DriveInfo> = {}): DriveInfo => ({
	name: `/dev/${faker.helpers.arrayElement(['sda', 'sdb', 'nvme0n1', 'nvme1n1'])}`,
	model: faker.commerce.productName(),
	size: faker.number.int({ min: 500_000_000_000, max: 8_000_000_000_000 }),
	type: faker.helpers.arrayElement(['ssd', 'hdd', 'nvme']),
	mount: faker.helpers.arrayElement(['/', '/home', '/data', null]),
	used: faker.number.int({ min: 100_000_000_000, max: 4_000_000_000_000 }),
	total: faker.number.int({ min: 500_000_000_000, max: 8_000_000_000_000 }),
	percent: faker.number.int({ min: 10, max: 95 }),
	...overrides,
});

export const makeMountInfo = (overrides: Partial<MountInfo> = {}): MountInfo => {
	const total = faker.number.int({ min: 100_000_000_000, max: 4_000_000_000_000 });
	const percent = faker.number.int({ min: 5, max: 95 });
	const used = Math.floor((total * percent) / 100);
	return {
		filesystem: '/dev/sda1',
		mount: faker.helpers.arrayElement(['/', '/home', '/data', '/var']),
		total,
		used,
		free: total - used,
		percent,
		...overrides,
	};
};

export const makeMachineSensor = (overrides: Partial<MachineSensor> = {}): MachineSensor => ({
	id: nextId('sensor'),
	label: faker.helpers.arrayElement(['CPU Temp', 'GPU Temp', 'Fan 1', 'Fan 2', '+12V', '+5V']),
	value: faker.number.float({ min: 30, max: 90, fractionDigits: 1 }),
	unit: faker.helpers.arrayElement(['celsius', 'rpm', 'volts'] as const),
	source: faker.helpers.arrayElement(['coretemp', 'nct6798', 'amdgpu']),
	...overrides,
});

export const makeProcessInfo = (overrides: Partial<ProcessInfo> = {}): ProcessInfo => ({
	pid: faker.number.int({ min: 100, max: 65535 }),
	user: faker.helpers.arrayElement(['root', 'cortex', 'www-data', 'postgres']),
	command: faker.helpers.arrayElement([
		'/usr/bin/dockerd',
		'node /opt/cortex/server.js',
		'postgres -D /var/lib/postgresql/data',
		'nginx: master',
		'systemd',
	]),
	cpu: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
	mem: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
	...overrides,
});

export const makeNetworkInterface = (
	overrides: Partial<NetworkInterface> = {},
): NetworkInterface => ({
	name: faker.helpers.arrayElement(['eth0', 'eth1', 'wlan0', 'tailscale0', 'br-cortex']),
	rxKbps: faker.number.float({ min: 0, max: 50_000, fractionDigits: 1 }),
	txKbps: faker.number.float({ min: 0, max: 25_000, fractionDigits: 1 }),
	rxBytesTotal: faker.number.int({ min: 0, max: 10_000_000_000 }),
	txBytesTotal: faker.number.int({ min: 0, max: 5_000_000_000 }),
	...overrides,
});

export const makeNetworkData = (overrides: Partial<NetworkData> = {}): NetworkData => ({
	interfaces: Array.from({ length: 3 }, () => makeNetworkInterface()),
	...overrides,
});

export const makeSystemData = (overrides: Partial<SystemData> = {}): SystemData => {
	const memoryTotal = 32 * 1024 * 1024 * 1024;
	const memoryPercent = faker.number.int({ min: 5, max: 95 });
	return {
		cpu: faker.number.int({ min: 1, max: 100 }),
		memory: {
			percent: memoryPercent,
			used: Math.floor((memoryTotal * memoryPercent) / 100),
			total: memoryTotal,
			free: memoryTotal - Math.floor((memoryTotal * memoryPercent) / 100),
		},
		drives: Array.from({ length: 2 }, () => makeDriveInfo()),
		mounts: Array.from({ length: 4 }, () => makeMountInfo()),
		load: [
			faker.number.float({ min: 0, max: 4, fractionDigits: 2 }),
			faker.number.float({ min: 0, max: 4, fractionDigits: 2 }),
			faker.number.float({ min: 0, max: 4, fractionDigits: 2 }),
		],
		uptime: faker.number.int({ min: 60, max: 60 * 60 * 24 * 30 }),
		sensors: {
			cpuTemperature: makeMachineSensor({ value: faker.number.int({ min: 35, max: 90 }) }),
			temperatures: Array.from({ length: 3 }, () => makeMachineSensor()),
			fans: Array.from({ length: 2 }, () =>
				makeMachineSensor({ unit: 'rpm', value: faker.number.int({ min: 800, max: 3500 }) }),
			),
			voltages: [],
		},
		timestamp: FROZEN_NOW,
		...overrides,
	};
};

// ─── Docker ────────────────────────────────────────────────────────
const DOCKER_IMAGE_NAMES = [
	'grafana/grafana:11.2.0',
	'prom/prometheus:v2.55.0',
	'prom/alertmanager:v0.27.0',
	'caddy:2.8-alpine',
	'postgres:16-alpine',
	'ollama/ollama:0.5.7',
	'ghcr.io/cortexos/9router:0.4.2',
	'ghcr.io/cortexos/mail-guardian:0.2.1',
];

export const makeDockerContainer = (
	overrides: Partial<DockerContainer> = {},
): DockerContainer => {
	const image = faker.helpers.arrayElement(DOCKER_IMAGE_NAMES);
	const state = faker.helpers.weightedArrayElement([
		{ value: 'running' as const, weight: 7 },
		{ value: 'exited' as const, weight: 2 },
		{ value: 'restarting' as const, weight: 1 },
	]);
	const name = image.split('/').pop()!.split(':')[0].replace(/[^a-z0-9-]/g, '-');
	return brandDockerContainer({
		id: nextId('ctn'),
		name: faker.helpers.arrayElement([`${name}-1`, `${name}-01`, `${name}-canary`]),
		image,
		status: state === 'running' ? 'Up 2 hours' : 'Exited (0) 5 minutes ago',
		state,
		ports:
			state === 'running'
				? [`${faker.number.int({ min: 3000, max: 9000 })}:${faker.number.int({ min: 80, max: 9000 })}`]
				: [],
		created: FROZEN_NOW,
		mounts: [],
		networkMode: 'bridge',
		env: { NODE_ENV: 'production' },
		...overrides,
	});
};

export const makeDockerImage = (overrides: Partial<DockerImage> = {}): DockerImage => {
	const imageName = faker.helpers.arrayElement(DOCKER_IMAGE_NAMES);
	const sha = faker.string.hexadecimal({ length: 64, casing: 'lower' }).replace(/^0x/, '');
	return brandDockerImage({
		id: `sha256:${sha}`,
		repo: imageName.split(':')[0],
		tag: imageName.split(':')[1] ?? 'latest',
		size: faker.number.int({ min: 50_000_000, max: 2_000_000_000 }),
		created: FROZEN_NOW,
		...overrides,
	});
};

export const makeDockerVolume = (overrides: Partial<DockerVolume> = {}): DockerVolume => {
	const name = faker.helpers.arrayElement([
		'grafana-data',
		'prometheus-data',
		'postgres-data',
		'ollama-models',
	]);
	return brandDockerVolume({
		name,
		driver: 'local',
		mountpoint: `/var/lib/docker/volumes/${name}/_data`,
		size: faker.number.int({ min: 0, max: 50_000_000_000 }),
		...overrides,
	});
};

export const makeDockerNetwork = (overrides: Partial<DockerNetwork> = {}): DockerNetwork => {
	const name = faker.helpers.arrayElement(['bridge', 'host', 'cortex-net', 'monitoring']);
	return brandDockerNetwork({
		id: nextId('net'),
		name,
		driver: 'bridge',
		scope: 'local',
		createdAt: FROZEN_NOW,
		...overrides,
	});
};

// ─── Incus ─────────────────────────────────────────────────────────
const INCUS_IMAGE_NAMES = [
	'ubuntu/24.04',
	'debian/12',
	'alpine/3.20',
	'fedora/40',
	'rockylinux/9',
];

const makeIncusConfig = (): IncusInstanceConfig => ({
	target: {
		mode: faker.helpers.arrayElement(['new', 'clone'] as const),
		repoUrl: faker.helpers.arrayElement([
			'https://github.com/cortexos/templates.git',
			null,
		]) as string | null,
		branch: 'main',
		ghOrg: 'cortexos',
		slug: faker.helpers.slugify(faker.lorem.words(2)),
		description: faker.lorem.sentence(),
	},
	image: {
		alias: faker.helpers.arrayElement(INCUS_IMAGE_NAMES),
		gastown: faker.datatype.boolean({ probability: 0.3 }),
		profiles: ['default', 'cortex'],
		cpu: faker.number.int({ min: 1, max: 8 }),
		memory: faker.helpers.arrayElement([1024, 2048, 4096, 8192]),
		pool: 'default',
	},
	hermes: {
		enabled: faker.datatype.boolean({ probability: 0.5 }),
		profile: 'cortex',
		port: faker.number.int({ min: 7000, max: 9000 }),
		model: faker.helpers.arrayElement(['qwen2.5-coder:7b', 'llama3.1:8b', null]),
		proxies: [],
	},
	network: {
		bridge: 'cortexbr0',
		tailscale: faker.datatype.boolean({ probability: 0.6 }),
		tailscaleKeyRef: null,
		webAccess: faker.datatype.boolean({ probability: 0.4 }),
	},
});

export const makeIncusInstanceDb = (
	overrides: Partial<IncusInstanceDb> = {},
): IncusInstanceDb => {
	const name = faker.helpers.slugify(faker.lorem.words(2));
	return brandIncusInstanceDb({
		name,
		slug: name,
		status: faker.helpers.arrayElement(['draft', 'validated', 'provisioning', 'active', 'failed'] as const),
		type: faker.helpers.arrayElement(INCUS_INSTANCE_TYPES),
		image: faker.helpers.arrayElement(INCUS_IMAGE_NAMES),
		cpu: faker.number.int({ min: 1, max: 8 }),
		memory: faker.helpers.arrayElement([1024, 2048, 4096, 8192]),
		config: makeIncusConfig(),
		devices: {
			root: { path: '/', pool: 'default', type: 'disk' },
			eth0: { name: 'eth0', network: 'cortexbr0', type: 'nic' },
		},
		lastValidation: null,
		createdBy: 'admin',
		createdAt: FROZEN_NOW,
		updatedAt: FROZEN_NOW,
		lastRequestId: null,
		liveStatus: faker.helpers.arrayElement(['Running', 'Stopped', null]),
		...overrides,
	});
};

export const makeIncusInstanceDetail = (
	overrides: Partial<IncusInstanceDetail> = {},
): IncusInstanceDetail => {
	const db = makeIncusInstanceDb();
	return brandIncusInstanceDetail({
		name: db.name,
		slug: db.slug,
		status: db.status,
		config: db.config,
		devices: db.devices,
		lastValidation: db.lastValidation,
		lastRequestId: db.lastRequestId,
		createdBy: db.createdBy,
		createdAt: db.createdAt,
		updatedAt: db.updatedAt,
		liveStatus: db.liveStatus,
		...overrides,
	});
};

export const makeIncusImage = (overrides: Partial<IncusImage> = {}): IncusImage => {
	const alias = faker.helpers.arrayElement(INCUS_IMAGE_NAMES);
	return brandIncusImage({
		fingerprint: faker.string.alphanumeric(64).toLowerCase(),
		architecture: faker.helpers.arrayElement(['x86_64', 'aarch64']),
		type: 'container',
		size: faker.number.int({ min: 80_000_000, max: 1_500_000_000 }),
		uploadedAt: FROZEN_NOW,
		aliases: [alias.split('/')[1] ?? alias],
		description: alias,
		os: alias.split('/')[0],
		release: alias.split('/')[1] ?? 'latest',
		...overrides,
	});
};

export const makeWizardDefaults = (overrides: Partial<WizardDefaults> = {}): WizardDefaults => ({
	image: faker.helpers.arrayElement(INCUS_IMAGE_NAMES),
	ghOrg: 'cortexos',
	bridge: 'cortexbr0',
	pool: 'default',
	branch: 'main',
	proxies: [],
	...overrides,
});

export const makeIncusPreflightReport = (
	overrides: Partial<IncusPreflightReport> = {},
): IncusPreflightReport => ({
	ok: faker.datatype.boolean({ probability: 0.9 }),
	checks: [
		{ id: 'disk-space', label: 'Sufficient disk space', pass: true },
		{ id: 'image-cache', label: 'Image cached locally', pass: faker.datatype.boolean() },
		{
			id: 'network-bridge',
			label: 'Network bridge available',
			pass: true,
			detail: 'cortexbr0 up',
		},
		{
			id: 'permissions',
			label: 'Caller has incus-admin group',
			pass: faker.datatype.boolean(),
			detail: 'OK',
		},
	],
	...overrides,
});

export const makeProgressStep = (overrides: Partial<ProgressStep> = {}): ProgressStep => ({
	step: faker.helpers.arrayElement([
		'preflight',
		'image-pull',
		'launch',
		'configure',
		'start',
		'verify',
	]),
	status: faker.helpers.arrayElement(['ok', 'done', 'running', 'error'] as const),
	n: faker.number.int({ min: 0, max: 100 }),
	total: 100,
	detail: faker.lorem.sentence(),
	...overrides,
});

export const makeIncusShellResult = (overrides: Partial<IncusShellResult> = {}): IncusShellResult => ({
	stdout: faker.lorem.sentences(2),
	stderr: '',
	exitCode: 0,
	...overrides,
});

// ─── Systemd ───────────────────────────────────────────────────────
const SYSTEMD_UNITS = [
	{ name: 'caddy.service', description: 'Caddy HTTP/3 reverse proxy' },
	{ name: 'postgresql.service', description: 'PostgreSQL database server' },
	{ name: 'docker.service', description: 'Docker Application Container Engine' },
	{ name: 'tailscaled.service', description: 'Tailscale node agent' },
	{ name: 'sshd.service', description: 'SSH per-connection server daemon' },
	{ name: 'cortexos-dashboard.service', description: 'CortexOS dashboard' },
	{ name: 'cortexos-backup.timer', description: 'CortexOS backup timer' },
	{ name: 'cortexos-update.timer', description: 'CortexOS update timer' },
];

export const makeSystemdUnit = (overrides: Partial<SystemdUnit> = {}): SystemdUnit => {
	const u = faker.helpers.arrayElement(SYSTEMD_UNITS);
	const active = faker.helpers.weightedArrayElement([
		{ value: 'active' as const, weight: 7 },
		{ value: 'inactive' as const, weight: 2 },
		{ value: 'failed' as const, weight: 1 },
	]);
	return brandSystemdUnit({
		name: u.name,
		description: u.description,
		load: faker.helpers.arrayElement(SYSTEMD_LOAD_STATES),
		active,
		sub: active === 'active' ? 'running' : 'dead',
		enabled: faker.datatype.boolean({ probability: 0.85 }),
		pid: active === 'active' ? faker.number.int({ min: 100, max: 65535 }) : undefined,
		path: `/etc/systemd/system/${u.name}`,
		...overrides,
	});
};

// ─── Terminal ──────────────────────────────────────────────────────
export const makeTerminalSession = (
	overrides: Partial<TerminalSession> = {},
): TerminalSession => {
	const connectedAt = new Date(FROZEN_NOW_EPOCH - faker.number.int({ min: 60_000, max: 1_800_000 })).toISOString();
	return brandTerminalSession({
		id: nextId('term'),
		userId: 'usr_admin',
		connectedAt,
		lastActivity: FROZEN_NOW,
		connected: true,
		cols: 80,
		rows: 24,
		shell: '/bin/bash',
		cwd: '/home/cortex',
		...overrides,
	});
};

export const makeTerminalCommand = (overrides: Partial<TerminalCommand> = {}): TerminalCommand => ({
	id: nextId('tcmd'),
	sessionId: 'term_0001',
	command: faker.helpers.arrayElement(['ls -la', 'docker ps', 'uptime', 'systemctl status caddy']),
	startedAt: FROZEN_NOW,
	finishedAt: FROZEN_NOW,
	exitCode: 0,
	stdout: faker.lorem.sentences(3),
	stderr: '',
	...overrides,
});

// ─── Audit / DCA / Approvals ──────────────────────────────────────
export const makeAuditEvent = (overrides: Partial<AuditEvent> = {}): AuditEvent => {
	const hash = faker.string.hexadecimal({ length: 64, casing: 'lower' }).replace(/^0x/, '');
	return brandAuditEvent({
		id: nextId('aud'),
		actorId: 'usr_admin',
		actorUsername: 'admin',
		action: faker.helpers.arrayElement(['docker.start', 'incus.exec', 'systemd.restart', 'auth.login']),
		target: 'srv_grafana',
		tool: faker.helpers.arrayElement(['docker', 'incus', 'systemd', 'auth']),
		toolClass: faker.helpers.arrayElement(['safe', 'privileged', 'destructive'] as const),
		decision: faker.helpers.arrayElement(['allow', 'deny', 'prompt'] as const),
		decisionReason: faker.helpers.arrayElement([null, faker.lorem.sentence()]),
		result: faker.helpers.arrayElement(['ok', 'err', 'timeout', 'denied'] as const),
		payload: { foo: 'bar' },
		ip: faker.internet.ipv4(),
		ua: faker.internet.userAgent(),
		createdAt: FROZEN_NOW,
		prevHash: null,
		currHash: hash,
		...overrides,
	});
};

export const makeDashboardCommandAudit = (
	overrides: Partial<DashboardCommandAudit> = {},
): DashboardCommandAudit => {
	const hash = faker.string.hexadecimal({ length: 64, casing: 'lower' }).replace(/^0x/, '');
	return brandDashboardCommandAudit({
		id: nextId('dca'),
		requestId: nextId('req'),
		requestedBy: 'admin',
		command: 'docker ps',
		status: faker.helpers.arrayElement(['pending', 'running', 'finished', 'failed'] as const),
		output: faker.lorem.sentences(2),
		error: null,
		startedAt: FROZEN_NOW,
		finishedAt: FROZEN_NOW,
		createdAt: FROZEN_NOW,
		updatedAt: FROZEN_NOW,
		prevHash: null,
		currHash: hash,
		...overrides,
	});
};

export const makeApprovalRequest = (
	overrides: Partial<ApprovalRequest> = {},
): ApprovalRequest => {
	return brandApprovalRequest({
		id: nextId('apr'),
		actor: 'admin',
		tool: faker.helpers.arrayElement(['docker', 'incus', 'systemd']),
		toolClass: faker.helpers.arrayElement(['safe', 'privileged', 'destructive'] as const),
		summary: faker.lorem.sentence(),
		argsPreview: { container: 'grafana' },
		requestedAt: FROZEN_NOW,
		status: faker.helpers.arrayElement(['pending', 'approved', 'denied', 'expired'] as const),
		reason: faker.helpers.arrayElement([null, faker.lorem.sentence()]),
		decider: faker.helpers.arrayElement([null, 'root']),
		decidedAt: faker.helpers.arrayElement([null, FROZEN_NOW]),
		tokenHash: faker.helpers.arrayElement([null, faker.string.alphanumeric(32)]),
		...overrides,
	});
};

// ─── Admin / badges / projects / agents / mail ─────────────────────
export const makeBadge = (overrides: Partial<Badge> = {}): Badge => {
	const slug = faker.helpers.slugify(faker.lorem.words(2)).toLowerCase();
	return brandBadge({
		slug,
		label: slug,
		color: faker.helpers.arrayElement(['emerald', 'amber', 'cortex', 'rose'] as const),
		textColor: '#fff',
		createdAt: FROZEN_NOW,
		...overrides,
	});
};

export const makeProject = (overrides: Partial<Project> = {}): Project => {
	const slug = faker.helpers.slugify(faker.lorem.words(2));
	return brandProject({
		slug,
		name: faker.company.name(),
		repoUrl: `https://github.com/cortexos/${slug}`,
		branch: 'main',
		messagingMode: faker.helpers.arrayElement(['single', 'distributed'] as const),
		description: faker.lorem.sentence(),
		createdAt: FROZEN_NOW,
		...overrides,
	});
};

export const makeAgent = (overrides: Partial<Agent> = {}): Agent => {
	const slug = faker.helpers.slugify(faker.lorem.words(2));
	return brandAgent({
		slug,
		name: faker.company.name(),
		description: faker.lorem.sentence(),
		project: slug,
		files: [
			{ name: 'AGENTS.md', path: `agents/${slug}/AGENTS.md`, language: 'markdown' },
			{ name: 'main.py', path: `agents/${slug}/main.py`, language: 'python' },
		],
		...overrides,
	});
};

export const makeMailReview = (overrides: Partial<MailReview> = {}): MailReview => {
	return brandMailReview({
		id: nextId('ml'),
		accountSlug: 'ops',
		messageUid: nextId('uid'),
		messageId: `<${faker.string.alphanumeric(20)}@example.com>`,
		fromAddr: faker.internet.email(),
		subject: faker.lorem.sentence(),
		modelVerdict: faker.helpers.arrayElement(['ham', 'spam', 'uncertain'] as const),
		modelConfidence: faker.number.float({ min: 0, max: 1, fractionDigits: 3 }),
		ownerDecision: faker.helpers.arrayElement([null, 'keep', 'spam'] as const),
		approver: faker.helpers.arrayElement([null, 'admin']),
		requestedAt: FROZEN_NOW,
		resolvedAt: faker.helpers.arrayElement([null, FROZEN_NOW]),
		processedAction: faker.helpers.arrayElement([null, 'allow', 'block']),
		queuedDecision: faker.helpers.arrayElement([null, 'keep', 'spam'] as const),
		queuedStatus: faker.helpers.arrayElement([null, 'sent', 'pending']),
		queuedError: null,
		...overrides,
	});
};

// ─── Backups / scheduler / notifications / logs / AI / prefs ──────
export const makeBackupSnapshot = (overrides: Partial<BackupSnapshot> = {}): BackupSnapshot => {
	return brandBackupSnapshot({
		id: nextId('bak'),
		name: `cortexos-${faker.date.recent().toISOString().slice(0, 10)}`,
		createdAt: FROZEN_NOW,
		size: faker.number.int({ min: 100_000_000, max: 50_000_000_000 }),
		status: faker.helpers.arrayElement(['healthy', 'stale', 'missing', 'corrupt'] as const),
		path: `/mnt/nas/backups/${faker.string.alphanumeric(8)}`,
		checksum: faker.string.alphanumeric(64),
		encrypted: true,
		...overrides,
	});
};

export const makeSchedulerJob = (overrides: Partial<SchedulerJob> = {}): SchedulerJob => {
	return brandSchedulerJob({
		id: nextId('job'),
		name: faker.helpers.arrayElement([
			'cortexos-backup.timer',
			'cortexos-update.timer',
			'cortexos-rotate.timer',
		]),
		schedule: faker.helpers.arrayElement(['daily', 'hourly', 'weekly']),
		nextRun: new Date(FROZEN_NOW_EPOCH + 3_600_000).toISOString(),
		lastRun: FROZEN_NOW,
		enabled: true,
		unit: faker.helpers.arrayElement([
			'cortexos-backup.service',
			'cortexos-update.service',
			'cortexos-rotate.service',
		]),
		description: faker.lorem.sentence(),
		...overrides,
	});
};

export const makeNotification = (overrides: Partial<NotificationEntry> = {}): NotificationEntry =>
	brandNotification({
		id: nextId('not'),
		channel: faker.helpers.arrayElement(['email', 'telegram', 'webhook']),
		message: faker.lorem.sentence(),
		sentAt: FROZEN_NOW,
		status: faker.helpers.arrayElement(['pending', 'sent', 'failed', 'read'] as const),
		read: faker.datatype.boolean({ probability: 0.4 }),
		severity: faker.helpers.arrayElement(['info', 'warning', 'error', 'critical'] as const),
		...overrides,
	});

export const makeLogEntry = (overrides: Partial<LogEntry> = {}): LogEntry => {
	const source = faker.helpers.arrayElement(['systemd', 'docker', 'incus', 'kernel', 'auditd']);
	const level = faker.helpers.weightedArrayElement([
		{ value: 'INFO' as const, weight: 7 },
		{ value: 'WARN' as const, weight: 2 },
		{ value: 'ERROR' as const, weight: 1 },
	]);
	return brandLogEntry({
		id: nextId('log'),
		timestamp: FROZEN_NOW,
		level,
		source,
		message: faker.lorem.sentence(),
		fields: { pid: faker.number.int({ min: 100, max: 65535 }) },
		...overrides,
	});
};

export const makeAIRequest = (overrides: Partial<AIRequest> = {}): AIRequest =>
	brandAIRequest({
		id: nextId('ai'),
		model: faker.helpers.arrayElement(['qwen2.5-coder:7b', 'llama3.1:8b', 'gpt-4o-mini']),
		messages: [{ role: 'user', content: faker.lorem.sentence() }],
		stream: faker.datatype.boolean(),
		policyClass: faker.helpers.arrayElement(['safe', 'privileged'] as const),
		createdAt: FROZEN_NOW,
		...overrides,
	});

export const makeAIResponse = (overrides: Partial<AIResponse> = {}): AIResponse =>
	brandAIResponse({
		id: nextId('ai-resp'),
		requestId: 'ai_0001',
		model: 'qwen2.5-coder:7b',
		content: faker.lorem.sentences(2),
		finishReason: 'stop',
		usage: {
			promptTokens: faker.number.int({ min: 50, max: 500 }),
			completionTokens: faker.number.int({ min: 50, max: 500 }),
			totalTokens: faker.number.int({ min: 100, max: 1000 }),
		},
		createdAt: FROZEN_NOW,
		...overrides,
	});

export const makeAppPreference = (overrides: Partial<AppPreference> = {}): AppPreference =>
	brandAppPreference({
		key: faker.helpers.slugify(faker.lorem.words(2)),
		value: { on: faker.datatype.boolean() },
		updatedAt: FROZEN_NOW,
		...overrides,
	});

export const makeWidgetConfig = (overrides: Partial<WidgetConfig> = {}): WidgetConfig =>
	brandWidgetConfig({
		id: nextId('wid'),
		kind: faker.helpers.arrayElement(['cpu', 'memory', 'storage', 'network']),
		x: faker.number.int({ min: 0, max: 12 }),
		y: faker.number.int({ min: 0, max: 12 }),
		w: faker.number.int({ min: 2, max: 6 }),
		h: faker.number.int({ min: 2, max: 4 }),
		settings: {},
		...overrides,
	});

export const makeDashboardLayout = (
	overrides: Partial<DashboardLayout> = {},
): DashboardLayout => {
	const widgets = Array.from({ length: 6 }, () => makeWidgetConfig());
	return brandDashboardLayout({
		id: nextId('layout'),
		name: 'default',
		widgets,
		isDefault: true,
		createdAt: FROZEN_NOW,
		updatedAt: FROZEN_NOW,
		...overrides,
	});
};

export const makeEnvLine = (overrides: Partial<EnvLine> = {}): EnvLine => {
	const type = faker.helpers.arrayElement(['kv', 'comment', 'blank'] as const);
	if (type === 'blank') {
		return { line: faker.number.int({ min: 1, max: 200 }), raw: '', type, ...overrides };
	}
	if (type === 'comment') {
		return {
			line: faker.number.int({ min: 1, max: 200 }),
			raw: `# ${faker.lorem.sentence()}`,
			type,
			...overrides,
		};
	}
	return {
		line: faker.number.int({ min: 1, max: 200 }),
		raw: `${faker.lorem.word().toUpperCase()}=${faker.internet.password()}`,
		type,
		key: asEnvVarName(faker.lorem.word().toUpperCase()),
		value: faker.internet.password(),
		exported: faker.datatype.boolean(),
		masked: faker.datatype.boolean({ probability: 0.5 }),
		...overrides,
	};
};

export const makeEnvBrowserResponse = (
	overrides: Partial<EnvBrowserResponse> = {},
): EnvBrowserResponse => ({
	path: '/opt/cortexos/.secrets/dashboard.env',
	lines: Array.from({ length: 12 }, () => makeEnvLine()),
	...overrides,
});

// List factories used by canonical.ts. Centralise list sizes here so
// the matrix's "list with N rows" assumptions live in one place.
export const makeContainerList = (n = 5) =>
	Array.from({ length: n }, (_, i) =>
		makeDockerContainer({ name: `ctn_${i.toString().padStart(2, '0')}` }),
	);
export const makeImageList = (n = 6) =>
	Array.from({ length: n }, (_, i) => makeDockerImage({ id: `sha256:${'a'.repeat(60)}${i}` }));
export const makeVolumeList = (n = 3) =>
	Array.from({ length: n }, (_, i) => makeDockerVolume({ name: `vol_${i.toString().padStart(2, '0')}` }));
export const makeIncusInstanceList = (n = 4) =>
	Array.from({ length: n }, (_, i) =>
		makeIncusInstanceDb({ name: asIncusInstanceId(`incus-${i.toString().padStart(2, '0')}`) }),
	);
export const makeSystemdUnitList = (n = 5) => Array.from({ length: n }, () => makeSystemdUnit());
export const makeAuditEventList = (n = 20) => Array.from({ length: n }, () => makeAuditEvent());
export const makeApprovalRequestList = (n = 3) =>
	Array.from({ length: n }, () => makeApprovalRequest());
export const makeBackupSnapshotList = (n = 3) =>
	Array.from({ length: n }, () => makeBackupSnapshot());
export const makeSchedulerJobList = (n = 3) => Array.from({ length: n }, () => makeSchedulerJob());
export const makePamUserList = (n = 4) => Array.from({ length: n }, () => _makePamUser());
export const makeBadgeList = (n = 5) => Array.from({ length: n }, () => makeBadge());
export const makeProjectList = (n = 3) => Array.from({ length: n }, () => makeProject());
export const makeMailReviewList = (n = 4) => Array.from({ length: n }, () => makeMailReview());
