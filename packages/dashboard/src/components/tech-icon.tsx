import type { ComponentType } from "react";
import { Docker, Grafana, MongoDB, MySQL, PostgreSQL, Redis } from "developer-icons";
import { Monogram } from "@/components/icons/monogram";

/**
 * Brand tint per slug. Reused as the fill for monogram fallback tiles so
 * brandless services still get a recognizable, stable color.
 */
export const BRAND_COLORS: Record<string, string> = {
	caddy: "#1f8dd6",
	"9router": "#6366f1",
	dockhand: "#06b6d4",
	"home-assistant": "#03a9f4",
	jellyfin: "#00a4dc",
	webmin: "#881113",
	cockpit: "#3e4245",
	ollama: "#1a1a1a",
	postgresql: "#336791",
	redis: "#dc382d",
	mysql: "#00758f",
	mongodb: "#47a248",
	grafana: "#f46800",
	prometheus: "#e6522c",
	loki: "#f6b545",
	"fluent-bit": "#49bda5",
	cadvisor: "#2196f3",
	tailscale: "#242424",
	minio: "#c72e49",
	rabbitmq: "#ff6600",
	incus: "#0b7285",
	watchtower: "#0b5394",
	docker: "#2496ed",
	obot: "#7c3aed",
	honcho: "#0ea5e9",
	hermes: "#d97706",
	gastown: "#16a34a",
	"mail-guardian": "#0891b2",
	"sandbox-runner": "#9333ea",
	"cortex-dashboard": "#4f46e5",
	"kernel-browser": "#db2777",
	"mongo-express": "#10b981",
	pgadmin: "#326690",
	phpmyadmin: "#6c78af",
	redisinsight: "#dc382d",
	"node-exporter": "#e6522c",
	"otel-collector": "#f5a800",
	"snmp-exporter": "#475569",
	"adguard-exporter": "#68bc71",
};

type DevIcon = ComponentType<{ size?: number; className?: string; color?: string }>;

/**
 * Slugs that resolve to a `developer-icons` React component.
 * Tree-shakeable: only the imported components above are bundled.
 */
const DEV_ICONS: Record<string, DevIcon> = {
	postgresql: PostgreSQL,
	redis: Redis,
	mongodb: MongoDB,
	mysql: MySQL,
	grafana: Grafana,
	docker: Docker,
};

/**
 * Slugs with a hand-vendored full-color brand SVG under `public/icons/`.
 * Served at the site root, referenced via <img src="/icons/<slug>.svg">.
 */
const VENDORED_SVGS: Record<string, string> = {
	prometheus: "/icons/prometheus.svg",
	loki: "/icons/loki.svg",
	caddy: "/icons/caddy.svg",
	tailscale: "/icons/tailscale.svg",
	ollama: "/icons/ollama.svg",
	jellyfin: "/icons/jellyfin.svg",
	"home-assistant": "/icons/home-assistant.svg",
	incus: "/icons/incus.svg",
	watchtower: "/icons/watchtower.svg",
	cockpit: "/icons/cockpit.svg",
	webmin: "/icons/webmin.svg",
};

export type TechIconSource = "developer-icons" | "vendored" | "monogram";

/** Which resolution path a slug takes. Useful for tests/introspection. */
export function techIconSource(name: string): TechIconSource {
	const slug = name.toLowerCase();
	if (DEV_ICONS[slug]) return "developer-icons";
	if (VENDORED_SVGS[slug]) return "vendored";
	return "monogram";
}

/** Full slug → source registry snapshot (computed from the maps above). */
export const TECH_ICON_REGISTRY: Record<string, TechIconSource> = {
	...Object.fromEntries(Object.keys(DEV_ICONS).map((s) => [s, "developer-icons" as const])),
	...Object.fromEntries(Object.keys(VENDORED_SVGS).map((s) => [s, "vendored" as const])),
};

function monogramLabel(slug: string): string {
	const parts = slug.split("-").filter(Boolean);
	if (parts.length > 1) {
		return (parts[0][0] + parts[1][0]).toUpperCase();
	}
	return slug.slice(0, 2).toUpperCase();
}

interface TechIconProps {
	/** Service slug (e.g. "postgresql", "obot"). Case-insensitive. */
	name: string;
	size?: number;
	className?: string;
	/** Optional override for the monogram tile fill. */
	color?: string;
}

/**
 * Resolve a service slug to its best available icon:
 *   1. developer-icons React component
 *   2. vendored brand SVG (public/icons/*.svg)
 *   3. monogram tile tinted by BRAND_COLORS (or `color`)
 *
 * SSR-safe (no client-only hooks) and tree-shakeable.
 */
export function TechIcon({ name, size = 40, className, color }: TechIconProps) {
	const slug = name.toLowerCase();

	const DevComponent = DEV_ICONS[slug];
	if (DevComponent) {
		return <DevComponent size={size} className={className} />;
	}

	const vendored = VENDORED_SVGS[slug];
	if (vendored) {
		return (
			// eslint-disable-next-line @next/next/no-img-element
			<img
				src={vendored}
				alt={slug}
				width={size}
				height={size}
				className={className}
				style={{ width: size, height: size, objectFit: "contain" }}
			/>
		);
	}

	const tint = color ?? BRAND_COLORS[slug] ?? "#525252";
	return (
		<Monogram label={monogramLabel(slug)} size={size} className={className} color={tint} />
	);
}
