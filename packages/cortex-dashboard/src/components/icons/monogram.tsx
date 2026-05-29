interface MonogramProps {
	/** 1-2 character label drawn on the tile. */
	label: string;
	size?: number;
	className?: string;
	/** Tile fill. Defaults to currentColor so it tints via the parent color. */
	color?: string;
}

/**
 * Brandless service icon: a rounded-square tile with a 1-2 letter monogram.
 * The tile uses `currentColor` by default so callers can tint it by setting
 * a CSS `color` (e.g. from a slug's BRAND_COLOR). SSR-safe, no client hooks.
 */
export function Monogram({ label, size = 40, className, color = "currentColor" }: MonogramProps) {
	const text = label.slice(0, 2).toUpperCase();
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 100 100"
			className={className}
			role="img"
			aria-label={text}
		>
			<rect width="100" height="100" rx="22" fill={color} />
			<text
				x="50"
				y="50"
				dominantBaseline="central"
				textAnchor="middle"
				fill="#fff"
				fontSize={text.length > 1 ? 44 : 56}
				fontWeight="700"
				fontFamily="system-ui, sans-serif"
			>
				{text}
			</text>
		</svg>
	);
}
