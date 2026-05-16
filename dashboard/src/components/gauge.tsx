"use client";

import { useEffect, useState } from "react";

interface GaugeProps {
	value: number;
	size?: number;
	strokeWidth?: number;
	color: string;
	label: string;
	sublabel?: string;
	icon?: React.ReactNode;
}

export function Gauge({
	value,
	size = 140,
	strokeWidth = 10,
	color,
	label,
	sublabel,
	icon,
}: GaugeProps) {
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const arcLength = circumference * 0.75;
	const offset = arcLength - (value / 100) * arcLength;
	const startAngle = 135;

	const [animatedValue, setAnimatedValue] = useState(0);

	useEffect(() => {
		const timer = setTimeout(() => setAnimatedValue(value), 50);
		return () => clearTimeout(timer);
	}, [value]);

	const getColor = (v: number) => {
		if (v > 85) return "#ef4444";
		if (v > 60) return "#f59e0b";
		return color;
	};

	const activeColor = getColor(animatedValue);

	return (
		<div className="flex flex-col items-center">
			<div className="relative" style={{ width: size, height: size }}>
				<svg
					width={size}
					height={size}
					viewBox={`0 0 ${size} ${size}`}
					className="transform -rotate-[135deg]"
				>
					{/* Background arc */}
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						stroke="currentColor"
						strokeWidth={strokeWidth}
						strokeLinecap="round"
						className="text-white/[0.06]"
						strokeDasharray={arcLength}
						strokeDashoffset={0}
					/>
					{/* Active arc */}
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						stroke={activeColor}
						strokeWidth={strokeWidth}
						strokeLinecap="round"
						strokeDasharray={arcLength}
						strokeDashoffset={offset}
						style={{
							transition:
								"stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s ease",
							filter: `drop-shadow(0 0 6px ${activeColor}40)`,
						}}
					/>
				</svg>
				{/* Center content */}
				<div className="absolute inset-0 flex flex-col items-center justify-center">
					{icon && <div className="mb-1 text-white/40 light:text-slate-700">{icon}</div>}
					<span
						className="text-3xl font-bold tabular-nums tracking-tight"
						style={{ color: activeColor, transition: "color 0.5s ease" }}
					>
						{animatedValue}%
					</span>
				</div>
			</div>
			<div className="mt-2 text-center">
				<p className="text-sm font-semibold text-white/80 light:text-slate-700">{label}</p>
				{sublabel && <p className="text-xs text-white/40 light:text-slate-700 mt-0.5">{sublabel}</p>}
			</div>
		</div>
	);
}
