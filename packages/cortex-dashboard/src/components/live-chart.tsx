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

interface DataPoint {
	time: string;
	cpu: number;
	mem: number;
}

interface LiveChartProps {
	data: DataPoint[];
}

export function LiveChart({ data }: LiveChartProps) {
	return (
		<div className="h-[280px] w-full">
			<ResponsiveContainer width="100%" height="100%">
				<AreaChart
					data={data}
					margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
				>
					<defs>
						<linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="var(--success)" stopOpacity={0.35} />
							<stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
						</linearGradient>
						<linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.25} />
							<stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
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
						domain={[0, 100]}
						stroke="rgba(255,255,255,0.15)"
						tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
						tickLine={false}
						axisLine={false}
						tickFormatter={(v) => `${v}%`}
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
							const label = nm === "cpu" ? "CPU" : "Memory";
							const color =
								nm === "cpu" ? "var(--success)" : "var(--chart-3)";
							return [
								<span
									key={nm}
									style={{ color }}
									className="font-mono font-bold"
								>
									{val}%
								</span>,
								label,
							];
						}}
					/>
					<Area
						type="monotone"
						dataKey="cpu"
						stroke="var(--success)"
						strokeWidth={2}
						fill="url(#cpuGrad)"
						isAnimationActive={false}
						dot={false}
					/>
					<Area
						type="monotone"
						dataKey="mem"
						stroke="var(--chart-3)"
						strokeWidth={2}
						fill="url(#memGrad)"
						isAnimationActive={false}
						dot={false}
					/>
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}
