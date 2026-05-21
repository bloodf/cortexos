"use client";

interface ServiceLogoProps {
	serviceId: string;
	size?: number;
	iconColor?: string | null;
	iconImage?: string | null;
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

export function ServiceLogo({ serviceId, size = 40, iconColor, iconImage }: ServiceLogoProps) {
	if (iconImage) {
		return (
			<div
				className="flex items-center justify-center shrink-0 overflow-hidden"
				style={{ width: size, height: size, borderRadius: size * 0.2 }}
			>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={iconImage}
					alt={serviceId}
					width={size}
					height={size}
					style={{ objectFit: "cover", width: size, height: size }}
				/>
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
