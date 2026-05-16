"use client";

export function SkeletonCard({
	children,
	className = "",
}: {
	children?: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`glass-panel rounded-2xl p-6 animate-pulse bg-white/[0.03] ${className}`}
		>
			{children ?? (
				<div className="space-y-3">
					<div className="h-4 bg-white/[0.06] rounded w-1/3" />
					<div className="h-20 bg-white/[0.04] rounded" />
					<div className="h-3 bg-white/[0.05] rounded w-2/3" />
				</div>
			)}
		</div>
	);
}

export function SkeletonText({
	lines = 3,
	className = "",
}: {
	lines?: number;
	className?: string;
}) {
	return (
		<div className={`space-y-2 ${className}`}>
			{Array.from({ length: lines }).map((_, i) => (
				<div
					key={i}
					className="h-3 bg-white/[0.06] rounded animate-pulse"
					style={{ width: `${70 + (i % 3) * 15}%` }}
				/>
			))}
		</div>
	);
}

export function SkeletonTable({
	rows = 5,
	cols = 6,
}: {
	rows?: number;
	cols?: number;
}) {
	return (
		<div className="space-y-2">
			<div className="flex gap-4 pb-2 border-b border-white/[0.06]">
				{Array.from({ length: cols }).map((_, i) => (
					<div
						key={i}
						className="h-3 bg-white/[0.08] rounded animate-pulse flex-1"
					/>
				))}
			</div>
			{Array.from({ length: rows }).map((_, r) => (
				<div key={r} className="flex gap-4 py-2">
					{Array.from({ length: cols }).map((_, c) => (
						<div
							key={c}
							className="h-3 bg-white/[0.04] rounded animate-pulse flex-1"
						/>
					))}
				</div>
			))}
		</div>
	);
}

export function SkeletonServiceGrid({ count = 8 }: { count?: number }) {
	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
			{Array.from({ length: count }).map((_, i) => (
				<div
					key={i}
					className="glass-panel rounded-xl p-4 animate-pulse bg-white/[0.03] h-20"
				/>
			))}
		</div>
	);
}
