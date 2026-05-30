"use client";

import {
	AreaChart,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
} from "recharts";

interface NetPoint {
	time: string;
	rx: number;
	tx: number;
}

interface NetChartProps {
	data: NetPoint[];
}

function formatKbps(v: number): string {
	if (v > 1024) return (v / 1024).toFixed(1) + " MB/s";
	return v.toFixed(0) + " KB/s";
}

export function NetChart({ data }: NetChartProps) {
	return (
		<div className="h-[280px] w-full">
			<ResponsiveContainer width="100%" height="100%">
				<AreaChart
					data={data}
					margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
				>
					<defs>
						<linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
							<stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
						</linearGradient>
						<linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.25} />
							<stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
						</linearGradient>
					</defs>
					<CartesianGrid
						strokeDasharray="3 3"
						stroke="rgba(255,255,255,0.04)"
						vertical={false}
					/>
					<XAxis
						dataKey="time"
						stroke="rgba(255,255,255,0.15)"
						tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
						tickLine={false}
						axisLine={false}
						interval="preserveStartEnd"
						minTickGap={40}
					/>
					<YAxis
						stroke="rgba(255,255,255,0.15)"
						tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
						tickLine={false}
						axisLine={false}
						tickFormatter={formatKbps}
					/>
					<Tooltip
						contentStyle={{
							backgroundColor: "rgba(10,10,15,0.95)",
							border: "1px solid rgba(255,255,255,0.1)",
							borderRadius: "8px",
							fontSize: "12px",
						}}
						itemStyle={{ color: "#fff" }}
						labelStyle={{ color: "rgba(255,255,255,0.5)" }}
						formatter={(value: unknown, name: unknown) => {
							const val = value as number;
							const nm = name as string;
							const label = nm === "rx" ? "Inbound" : "Outbound";
							const color =
								nm === "rx" ? "var(--chart-2)" : "var(--chart-4)";
							return [
								<span
									key={nm}
									style={{ color }}
									className="font-mono font-bold"
								>
									{formatKbps(val)}
								</span>,
								label,
							];
						}}
					/>
					<Area
						type="monotone"
						dataKey="rx"
						stroke="var(--chart-2)"
						strokeWidth={2}
						fill="url(#rxGrad)"
						isAnimationActive={false}
						dot={false}
					/>
					<Area
						type="monotone"
						dataKey="tx"
						stroke="var(--chart-4)"
						strokeWidth={2}
						fill="url(#txGrad)"
						isAnimationActive={false}
						dot={false}
					/>
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}
