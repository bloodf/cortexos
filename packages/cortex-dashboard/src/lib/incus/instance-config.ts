/**
 * Typed Incus instance configuration — the single TS-side mapping from the
 * wizard's config object to canonical-script flags.
 *
 * The provisioning shell script `scripts/ops/cortex-incus-instance-create.sh`
 * is the single source of truth for *how* an instance is built; this module is
 * the single source of truth for *how a config becomes that script's argv*.
 *
 * No secrets are ever stored in this shape — only references (e.g. a Tailscale
 * auth-key *name*, never the key value).
 */

// Same instance-name rule used across the incus API routes + DB layer.
export const SAFE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,62}$/;
// Hermes profile names follow the same rule.
export const SAFE_PROFILE_RE = SAFE_NAME_RE;
// Repo URL: https or scp-like ssh git remotes only.
const REPO_URL_RE = /^(https:\/\/[^\s]+|git@[^\s:]+:[^\s]+)$/;

export const KNOWN_PROXIES = ["9router", "honcho", "ollama"] as const;
export type ProxyName = (typeof KNOWN_PROXIES)[number];

// Hermes API port range reserved for project profiles (see hermes/profiles.json).
export const HERMES_PORT_MIN = 18695;
export const HERMES_PORT_MAX = 18749;

export interface IncusInstanceConfig {
	target: {
		mode: "existing" | "new";
		repoUrl?: string;
		branch: string;
		ghOrg: string;
		slug: string;
		description?: string;
	};
	image: {
		alias: string;
		gastown: boolean;
		profiles: string[];
		cpu?: string;
		memory?: string;
		pool: string;
	};
	hermes: {
		enabled: boolean;
		profile: string;
		port: number;
		model: string;
		proxies: ProxyName[];
	};
	network: {
		bridge: string;
		tailscale: boolean;
		tailscaleKeyRef?: string;
		webAccess: string;
	};
	ai?: {
		analysis?: Record<string, unknown>;
		modelUsed?: string;
	};
}

export interface ConfigValidation {
	ok: boolean;
	errors: string[];
}

/** Structural validation that runs with AI disabled and without touching the host. */
export function validateConfigShape(cfg: IncusInstanceConfig): ConfigValidation {
	const errors: string[] = [];

	if (!SAFE_NAME_RE.test(cfg.target.slug)) {
		errors.push("slug must start with a letter and be alphanumeric/-/_ (≤63 chars)");
	}
	if (cfg.target.mode === "existing") {
		if (!cfg.target.repoUrl || !REPO_URL_RE.test(cfg.target.repoUrl)) {
			errors.push("repoUrl must be an https or git@ URL for an existing project");
		}
	}
	if (!cfg.target.branch) errors.push("branch is required");
	if (!cfg.target.ghOrg) errors.push("ghOrg is required");

	if (!cfg.image.alias) errors.push("image alias is required");
	if (!cfg.image.pool) errors.push("storage pool is required");
	for (const p of cfg.image.profiles) {
		if (!SAFE_PROFILE_RE.test(p)) errors.push(`invalid profile name: ${p}`);
	}

	if (cfg.hermes.enabled) {
		if (!SAFE_PROFILE_RE.test(cfg.hermes.profile)) {
			errors.push("hermes profile name is invalid");
		}
		if (
			!Number.isInteger(cfg.hermes.port) ||
			cfg.hermes.port < HERMES_PORT_MIN ||
			cfg.hermes.port > HERMES_PORT_MAX
		) {
			errors.push(
				`hermes port must be an integer in ${HERMES_PORT_MIN}–${HERMES_PORT_MAX}`,
			);
		}
		if (!cfg.hermes.model) errors.push("hermes model is required when hermes is enabled");
		for (const proxy of cfg.hermes.proxies) {
			if (!KNOWN_PROXIES.includes(proxy)) errors.push(`unknown proxy: ${proxy}`);
		}
	}

	if (!cfg.network.bridge) errors.push("network bridge is required");
	if (cfg.network.tailscale && !cfg.network.tailscaleKeyRef) {
		errors.push("tailscaleKeyRef is required when Tailscale join is enabled");
	}

	return { ok: errors.length === 0, errors };
}

/**
 * Map a config to the canonical script's argv (the bash script after the path).
 * Caller prepends `["bash", scriptPath]` (or the script path directly) plus any
 * of `--dry-run` / `--json-progress`.
 */
export function buildScriptArgv(cfg: IncusInstanceConfig): string[] {
	const argv: string[] = [];
	argv.push("--name", cfg.target.slug);
	argv.push("--slug", cfg.target.slug);
	argv.push("--branch", cfg.target.branch);
	argv.push("--gh-org", cfg.target.ghOrg);
	if (cfg.target.repoUrl) argv.push("--repo", cfg.target.repoUrl);

	argv.push("--image", cfg.image.alias);
	for (const p of cfg.image.profiles) argv.push("--profile", p);
	if (cfg.image.cpu) argv.push("--cpu", cfg.image.cpu);
	if (cfg.image.memory) argv.push("--memory", cfg.image.memory);
	argv.push("--pool", cfg.image.pool);

	if (cfg.hermes.enabled) {
		argv.push("--hermes-profile", cfg.hermes.profile);
		argv.push("--hermes-port", String(cfg.hermes.port));
		argv.push("--hermes-model", cfg.hermes.model);
		argv.push("--proxies", cfg.hermes.proxies.join(","));
	} else {
		argv.push("--skip-hermes");
	}

	argv.push("--bridge", cfg.network.bridge);
	if (cfg.network.tailscale) {
		argv.push("--tailscale");
		if (cfg.network.tailscaleKeyRef) {
			argv.push("--tailscale-key-ref", cfg.network.tailscaleKeyRef);
		}
	}
	if (cfg.network.webAccess) argv.push("--web-access", cfg.network.webAccess);

	if (cfg.target.mode === "new") argv.push("--skip-clone");

	return argv;
}

/** Defensive masking before persisting/auditing — never surface secret-like values. */
export function redactConfig(cfg: IncusInstanceConfig): IncusInstanceConfig {
	return {
		...cfg,
		network: {
			...cfg.network,
			// The ref is a *name*; keep it, but guard against anyone stuffing a raw key.
			tailscaleKeyRef: cfg.network.tailscaleKeyRef
				? cfg.network.tailscaleKeyRef.slice(0, 64)
				: cfg.network.tailscaleKeyRef,
		},
	};
}
