import { readFileSync } from "node:fs";
import { getAllServices } from "@/lib/db/service";
import { listBadgesForService } from "@/lib/db/service-badges";
import { getCurrentSession } from "@/lib/auth";
import { AppsPanel } from "@/components/apps/apps-panel";

type AppCredentials = { username?: string; password?: string; note?: string };

const CREDENTIAL_ENV: Record<string, { username: string[]; password: string[]; note?: string }> = {
	grafana: { username: ["GF_SECURITY_ADMIN_USER", "GRAFANA_USERNAME"], password: ["GF_SECURITY_ADMIN_PASSWORD", "GRAFANA_PASSWORD"] },
	pgadmin: { username: ["PGADMIN_DEFAULT_EMAIL", "PGADMIN_USERNAME"], password: ["PGADMIN_DEFAULT_PASSWORD", "PGADMIN_PASSWORD"] },
	"mongo-express": { username: ["ME_CONFIG_BASICAUTH_USERNAME", "MONGO_EXPRESS_USERNAME"], password: ["ME_CONFIG_BASICAUTH_PASSWORD", "MONGO_EXPRESS_PASSWORD"] },
	phpmyadmin: { username: ["MYSQL_USER", "MYSQL_ROOT_USER", "PHPMYADMIN_USERNAME"], password: ["MYSQL_PASSWORD", "MYSQL_ROOT_PASSWORD", "PHPMYADMIN_PASSWORD"] },
	langfuse: { username: ["LANGFUSE_INIT_USER_EMAIL", "LANGFUSE_USERNAME"], password: ["LANGFUSE_INIT_USER_PASSWORD", "LANGFUSE_PASSWORD"] },
	redisinsight: { username: ["REDISINSIGHT_USERNAME"], password: ["REDISINSIGHT_PASSWORD"] },
	dockhand: { username: [], password: ["DOCKGE_SECRET"], note: "Dockhand uses the Dockge secret as its setup/login secret." },
	cockpit: { username: [], password: [], note: "Use a Linux system account. Admin access requires cortexos-admin or sudo group membership." },
	webmin: { username: [], password: [], note: "Use a Linux system account. Admin access requires cortexos-admin or sudo group membership." },
	"home-assistant": { username: [], password: [], note: "Credentials are created in the Home Assistant first-run wizard." },
	jellyfin: { username: [], password: [], note: "Credentials are created in the Jellyfin first-run wizard." },
};

function parseCredentialJson(): Record<string, AppCredentials> {
	const raw = process.env.APP_CREDENTIALS_JSON;
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw) as Record<string, AppCredentials>;
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch (error) {
		console.warn("[apps] APP_CREDENTIALS_JSON parse failed:", error instanceof Error ? error.message : "invalid JSON");
		return {};
	}
}

function parseEnvLine(line: string): [string, string] | null {
	const trimmed = line.trim();
	if (!trimmed || trimmed.startsWith("#")) return null;
	const index = trimmed.indexOf("=");
	if (index <= 0) return null;
	const key = trimmed.slice(0, index).trim();
	let value = trimmed.slice(index + 1).trim();
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		value = value.slice(1, -1);
	}
	return [key, value];
}

function readEnvFile(path: string | null | undefined): Record<string, string> {
	if (!path) return {};
	try {
		const entries: Record<string, string> = {};
		for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
			const parsed = parseEnvLine(line);
			if (parsed) entries[parsed[0]] = parsed[1];
		}
		return entries;
	} catch {
		return {};
	}
}

function firstValue(keys: string[], fileEnv: Record<string, string>): string | undefined {
	for (const key of keys) {
		const value = fileEnv[key]?.trim() || process.env[key]?.trim();
		if (value) return value;
	}
	return undefined;
}

function credentialsFor(
	slug: string,
	isAdmin: boolean,
	fromJson: Record<string, AppCredentials>,
	envSource: string | null | undefined,
): AppCredentials | null {
	if (!isAdmin) return null;
	if (fromJson[slug]) return fromJson[slug];
	const env = CREDENTIAL_ENV[slug];
	if (!env) return null;
	const fileEnv = readEnvFile(envSource);
	const username = firstValue(env.username, fileEnv);
	const password = firstValue(env.password, fileEnv);
	if (!username && !password) {
		return env.note ? { note: env.note } : { note: envSource ? `No known credential keys found in ${envSource}.` : "Credentials are not configured." };
	}
	return { username, password, note: env.note };
}

function safeOpenUrl(openUrl: string, isAdmin: boolean): string {
	if (isAdmin || openUrl === "#") return openUrl;
	try {
		const url = new URL(openUrl);
		if (url.search) return `${url.origin}${url.pathname}${url.hash}`;
		return openUrl;
	} catch {
		return openUrl.includes("?") ? openUrl.split("?")[0] : openUrl;
	}
}

export default async function AppsPage() {
	const rawServices = await getAllServices();
	const session = await getCurrentSession();
	const isAdmin = session?.user.is_admin === true;
	const credentials = parseCredentialJson();

	const withBadges = await Promise.all(
		rawServices
			.filter((s) => s.has_webui && s.show_in_webui && s.open_url !== "#")
			.map(async (s) => {
				const badges = await listBadgesForService(s.id).catch(() => []);
				return {
					id: s.id,
					slug: s.slug,
					name: s.name,
					open_url: safeOpenUrl(s.open_url, isAdmin),
					category: s.category,
					status: "unknown" as const,
					responseTime: 0,
					icon_color: s.icon_color,
					icon_image: s.icon_image,
					env_source: s.env_source,
					badges: badges.map((b) => ({
						slug: b.slug,
						label: b.label,
						color: b.color,
					})),
					credentials: credentialsFor(s.slug, isAdmin, credentials, s.env_source),
				};
			}),
	);

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold text-white/90 light:text-slate-800">
				Apps
			</h1>
			<AppsPanel services={withBadges} isAdmin={isAdmin} />
		</div>
	);
}

export const dynamic = "force-dynamic";
