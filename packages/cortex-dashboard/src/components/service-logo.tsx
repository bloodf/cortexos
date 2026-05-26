"use client";

import type { ComponentType } from "react";
import {
	AWS,
	Apache,
	Anthropic,
	Bash,
	Chrome,
	Chromium,
	Cloudflare,
	Docker,
	FastAPI,
	Git,
	GitHubDark,
	Gmail,
	GoogleCloud,
	Grafana,
	Homebrew,
	Kubernetes,
	Linux,
	MongoDB,
	MySQL,
	NextJs,
	NodeJs,
	OpenAI,
	PHP,
	PnpmDark,
	PostgreSQL,
	Python,
	React,
	Redis,
	Slack,
	TailwindCSS,
	Telegram,
	Terraform,
	TypeScript,
	Ubuntu,
	ViteJS,
	Vitest,
	JavaScript,
} from "developer-icons";

interface ServiceLogoProps {
	serviceId: string;
	serviceName?: string;
	size?: number;
	iconColor?: string | null;
	iconImage?: string | null;
}

type DeveloperIconComponent = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;

const DEVELOPER_ICON_BY_TOKEN: Record<string, { icon: DeveloperIconComponent; name: string }> = {
	"9router": { icon: OpenAI, name: "OpenAI" },
	agentgateway: { icon: OpenAI, name: "OpenAI" },
	anthropic: { icon: Anthropic, name: "Anthropic" },
	apache: { icon: Apache, name: "Apache" },
	aws: { icon: AWS, name: "AWS" },
	bash: { icon: Bash, name: "Bash" },
	cadvisor: { icon: Docker, name: "Docker" },
	chrome: { icon: Chrome, name: "Chrome" },
	chromium: { icon: Chromium, name: "Chromium" },
	cloudflare: { icon: Cloudflare, name: "Cloudflare" },
	cockpit: { icon: Linux, name: "Linux" },
	cortex: { icon: NextJs, name: "Next.js" },
	dashboard: { icon: NextJs, name: "Next.js" },
	dnsmasq: { icon: Linux, name: "Linux" },
	dockge: { icon: Docker, name: "Docker" },
	docker: { icon: Docker, name: "Docker" },
	dockhand: { icon: Docker, name: "Docker" },
	email: { icon: Gmail, name: "Gmail" },
	fail2ban: { icon: Linux, name: "Linux" },
	fastapi: { icon: FastAPI, name: "FastAPI" },
	floci: { icon: AWS, name: "AWS" },
	git: { icon: Git, name: "Git" },
	github: { icon: GitHubDark, name: "GitHub" },
	gmail: { icon: Gmail, name: "Gmail" },
	googlecloud: { icon: GoogleCloud, name: "Google Cloud" },
	grafana: { icon: Grafana, name: "Grafana" },
	homebrew: { icon: Homebrew, name: "Homebrew" },
	javascript: { icon: JavaScript, name: "JavaScript" },
	kernel: { icon: Chromium, name: "Chromium" },
	kubernetes: { icon: Kubernetes, name: "Kubernetes" },
	langfuse: { icon: OpenAI, name: "OpenAI" },
	linux: { icon: Linux, name: "Linux" },
	localstack: { icon: AWS, name: "AWS" },
	mail: { icon: Gmail, name: "Gmail" },
	mongodb: { icon: MongoDB, name: "MongoDB" },
	mongoexpress: { icon: MongoDB, name: "MongoDB" },
	mysql: { icon: MySQL, name: "MySQL" },
	nextjs: { icon: NextJs, name: "Next.js" },
	node: { icon: NodeJs, name: "Node.js" },
	nodejs: { icon: NodeJs, name: "Node.js" },
	ollama: { icon: OpenAI, name: "OpenAI" },
	openai: { icon: OpenAI, name: "OpenAI" },
	pgadmin: { icon: PostgreSQL, name: "PostgreSQL" },
	pgexporter: { icon: PostgreSQL, name: "PostgreSQL" },
	php: { icon: PHP, name: "PHP" },
	phpmyadmin: { icon: MySQL, name: "MySQL" },
	pnpm: { icon: PnpmDark, name: "pnpm" },
	postgres: { icon: PostgreSQL, name: "PostgreSQL" },
	postgresql: { icon: PostgreSQL, name: "PostgreSQL" },
	python: { icon: Python, name: "Python" },
	react: { icon: React, name: "React" },
	redis: { icon: Redis, name: "Redis" },
	redisinsight: { icon: Redis, name: "Redis" },
	slack: { icon: Slack, name: "Slack" },
	tailwind: { icon: TailwindCSS, name: "Tailwind CSS" },
	telegram: { icon: Telegram, name: "Telegram" },
	terraform: { icon: Terraform, name: "Terraform" },
	typescript: { icon: TypeScript, name: "TypeScript" },
	ubuntu: { icon: Ubuntu, name: "Ubuntu" },
	vite: { icon: ViteJS, name: "Vite" },
	vitest: { icon: Vitest, name: "Vitest" },
	watchtower: { icon: Docker, name: "Docker" },
	webmin: { icon: Linux, name: "Linux" },
};

const EXACT_ICON_ALIASES: Record<string, string> = {
	"cortex-dashboard": "dashboard",
	"email-spam-poll": "email",
	"fluent-bit": "linux",
	"hermes-primary": "openai",
	"hermes-secondary": "openai",
	"kernel-browser": "kernel",
	"mongo-express": "mongoexpress",
	"mongo-exporter": "mongodb",
	"node-exporter": "linux",
	"ollama-honcho-embeddings-proxy": "ollama",
	"otel-collector": "linux",
	"pg-exporter": "pgexporter",
	"promtail": "linux",
	"redis-exporter": "redis",
};

const OFFICIAL_GIT_LOGOS: Record<string, string> = {
	"9router": "/vendor-icons/9router.svg",
	honcho: "/vendor-icons/honcho.svg",
	"hermes-dashboard": "/vendor-icons/hermes.svg",
	"hermes-primary": "/vendor-icons/hermes.svg",
	"hermes-secondary": "/vendor-icons/hermes.svg",
	langfuse: "/vendor-icons/langfuse.svg",
	paperclip: "/vendor-icons/paperclip.svg",
};

function iconTokens(...values: Array<string | undefined>): string[] {
	const tokens = new Set<string>();
	for (const value of values) {
		if (!value) continue;
		const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
		if (!normalized) continue;
		tokens.add(normalized.replace(/\s+/g, ""));
		for (const token of normalized.split(/\s+/)) tokens.add(token);
	}
	return [...tokens];
}

function resolveDeveloperIcon(serviceId: string, serviceName?: string) {
	const exact = EXACT_ICON_ALIASES[serviceId] || serviceId;
	for (const token of iconTokens(exact, serviceName)) {
		const match = DEVELOPER_ICON_BY_TOKEN[token];
		if (match) return match;
	}
	return null;
}

function ImageLogo({ src, alt, size }: { src: string; alt: string; size: number }) {
	return (
		<div
			className="flex items-center justify-center shrink-0 overflow-hidden bg-white"
			style={{ width: size, height: size, borderRadius: size * 0.2 }}
		>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={src}
				alt={alt}
				width={size}
				height={size}
				style={{ objectFit: "contain", width: size, height: size, padding: Math.max(2, size * 0.12) }}
			/>
		</div>
	);
}

function InitialAvatar({
	text,
	bg,
	size,
}: {
	text: string;
	bg: string;
	size: number;
}) {
	return (
		<div
			className="flex items-center justify-center shrink-0"
			style={{ width: size, height: size }}
		>
			<svg width={size} height={size} viewBox="0 0 100 100">
				<rect width="100" height="100" rx="20" fill={bg} />
				<text
					x="50"
					y="64"
					textAnchor="middle"
					fill="white"
					fontSize={size * 0.45 * 2.2}
					fontWeight="700"
					fontFamily="system-ui"
				>
					{text}
				</text>
			</svg>
		</div>
	);
}

const BRAND_COLORS: Record<string, string> = {
	"9router": "#6366f1",
	honcho: "#0ea5e9",
	"hermes-primary": "#f97316",
	"hermes-secondary": "#f97316",
	hindsight: "#f59e0b",
	floci: "#ff9900",
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
	"fluent-bit": "#49bda5",
	cadvisor: "#2196f3",
	tailscale: "#242424",
};

export function ServiceLogo({ serviceId, serviceName, size = 40, iconColor, iconImage }: ServiceLogoProps) {
	if (iconImage) {
		return <ImageLogo src={iconImage} alt={serviceName || serviceId} size={size} />;
	}

	const officialGitLogo = OFFICIAL_GIT_LOGOS[serviceId];
	if (officialGitLogo) {
		return <ImageLogo src={officialGitLogo} alt={serviceName || serviceId} size={size} />;
	}

	const developerIcon = resolveDeveloperIcon(serviceId, serviceName);
	if (developerIcon) {
		const Icon = developerIcon.icon;
		return (
			<div
				className="flex items-center justify-center shrink-0 overflow-hidden rounded-md bg-white"
				style={{ width: size, height: size }}
				role="img"
				aria-label={`${serviceName || serviceId} logo`}
				data-developer-icon={developerIcon.name}
			>
				<Icon size={Math.max(16, Math.round(size * 0.78))} aria-hidden className="shrink-0" />
			</div>
		);
	}

	const bg = iconColor || BRAND_COLORS[serviceId] || "#525252";
	const abbr = serviceId
		.split("-")
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
	return <InitialAvatar text={abbr} bg={bg} size={size} />;
}
