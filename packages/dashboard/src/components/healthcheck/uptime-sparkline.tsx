"use client";

import {
	AreaChart,
	Area,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface SparklinePoint {
	time: string;
	value: number;
}

interface UptimeSparklineProps {
	title: string;
	data: SparklinePoint[];
	color?: string;
	unit?: string;
}

export function UptimeSparkline({
	title,
	data,
	color = "var(--success)",
	unit = "%",
}: UptimeSparklineProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="h-[120px] w-full">
					<ResponsiveContainer width="100%" height="100%">
						<AreaChart
							data={data}
							margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
						>
							<defs>
								<linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor={color} stopOpacity={0.3} />
									<stop offset="100%" stopColor={color} stopOpacity={0} />
								</linearGradient>
							</defs>
							<XAxis
								dataKey="time"
								stroke="var(--border)"
								tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
								tickLine={false}
								axisLine={false}
								interval="preserveStartEnd"
								minTickGap={32}
							/>
							<YAxis
								domain={[0, 100]}
								stroke="var(--border)"
								tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
								tickLine={false}
								axisLine={false}
								tickFormatter={(v) => `${v}${unit}`}
							/>
							<Tooltip
								contentStyle={{
									backgroundColor: "var(--popover)",
									border: "1px solid var(--border)",
									borderRadius: "8px",
									fontSize: "12px",
								}}
								itemStyle={{ color: "var(--popover-foreground)" }}
								labelStyle={{ color: "var(--muted-foreground)" }}
								formatter={(value: unknown) => [
									<span
										key="val"
										style={{ color }}
										className="font-mono font-bold"
									>
										{value as number}
										{unit}
									</span>,
									title,
								]}
							/>
							<Area
								type="monotone"
								dataKey="value"
								stroke={color}
								strokeWidth={2}
								fill={`url(#grad-${title})`}
								isAnimationActive={false}
								dot={false}
							/>
						</AreaChart>
					</ResponsiveContainer>
				</div>
			</CardContent>
		</Card>
	);
}
