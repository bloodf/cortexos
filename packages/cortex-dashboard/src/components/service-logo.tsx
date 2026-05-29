"use client";

import { BRAND_COLORS, TechIcon } from "@/components/tech-icon";

interface ServiceLogoProps {
	serviceId: string;
	size?: number;
	iconColor?: string | null;
	iconImage?: string | null;
}

// Re-exported for backward compatibility with any existing importers.
export { BRAND_COLORS };

/**
 * Service icon. Resolution order:
 *   1. An explicit uploaded image (`iconImage`) — rendered as-is.
 *   2. A real brand/tech icon via {@link TechIcon} (developer-icons → vendored
 *      SVG → tinted monogram fallback).
 *
 * Props/signature are unchanged so existing call sites keep working.
 */
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

	return (
		<div
			className="flex items-center justify-center shrink-0"
			style={{ width: size, height: size }}
		>
			<TechIcon name={serviceId} size={size} color={iconColor ?? undefined} />
		</div>
	);
}
