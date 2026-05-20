import { getAllServices } from "@/lib/db/service";
import { listBadgesForService } from "@/lib/db/service-badges";
import { getCurrentSession } from "@/lib/auth";
import { AppsPanel } from "@/components/apps/apps-panel";

type AppCredentials = { username?: string; password?: string; note?: string };

const CREDENTIAL_ENV: Record<string, { username: string[]; password: string[] }> = {
	grafana: { username: ["GRAFANA_USERNAME", "GF_SECURITY_ADMIN_USER"], password: ["GRAFANA_PASSWORD", "GF_SECURITY_ADMIN_PASSWORD"] },
	pgadmin: { username: ["PGADMIN_USERNAME", "PGADMIN_DEFAULT_EMAIL"], password: ["PGADMIN_PASSWORD", "PGADMIN_DEFAULT_PASSWORD"] },
	"mongo-express": { username: ["MONGO_EXPRESS_USERNAME", "ME_CONFIG_BASICAUTH_USERNAME"], password: ["MONGO_EXPRESS_PASSWORD", "ME_CONFIG_BASICAUTH_PASSWORD"] },
	phpmyadmin: { username: ["PHPMYADMIN_USERNAME", "MYSQL_USER", "MYSQL_ROOT_USER"], password: ["PHPMYADMIN_PASSWORD", "MYSQL_PASSWORD", "MYSQL_ROOT_PASSWORD"] },
	langfuse: { username: ["LANGFUSE_USERNAME", "LANGFUSE_INIT_USER_EMAIL"], password: ["LANGFUSE_PASSWORD", "LANGFUSE_INIT_USER_PASSWORD"] },
	redisinsight: { username: ["REDISINSIGHT_USERNAME"], password: ["REDISINSIGHT_PASSWORD"] },
};

function parseCredentialJson(): Record<string, AppCredentials> {
	const raw = process.env.APP_CREDENTIALS_JSON;
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw) as Record<string, AppCredentials>;
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}

function firstEnv(keys: string[]): string | undefined {
	for (const key of keys) {
		const value = process.env[key]?.trim();
		if (value) return value;
	}
	return undefined;
}

function credentialsFor(slug: string, isAdmin: boolean, fromJson: Record<string, AppCredentials>): AppCredentials | null {
	if (!isAdmin) return null;
	if (fromJson[slug]) return fromJson[slug];
	const env = CREDENTIAL_ENV[slug];
	if (!env) return null;
	const username = firstEnv(env.username);
	const password = firstEnv(env.password);
	if (!username && !password) {
		return { note: "Credentials are not configured in dashboard env." };
	}
	return { username, password };
}

export default async function AppsPage() {
	const rawServices = await getAllServices();
	const session = await getCurrentSession();
	const isAdmin = session?.user.is_admin === true;
	const credentials = parseCredentialJson();

	const withBadges = await Promise.all(
		rawServices
			.filter((s) => s.open_url !== "#")
			.map(async (s) => {
				const badges = await listBadgesForService(s.id).catch(() => []);
				return {
					id: s.id,
					slug: s.slug,
					name: s.name,
					open_url: s.open_url,
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
					credentials: credentialsFor(s.slug, isAdmin, credentials),
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
