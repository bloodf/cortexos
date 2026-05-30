"use client";

import { Plus, Rows3, Columns3, X } from "lucide-react";
import { WIDGET_LABELS, WIDGET_REGISTRY } from "@/components/dashboard-widgets";
import type { LayoutItem } from "./types";

export function LayoutNode({
	item,
	editMode,
	onRemove,
	onAddWidget,
	onAddContainer,
}: {
	item: LayoutItem;
	editMode: boolean;
	onRemove: () => void;
	onAddWidget: (containerId: string, widgetId: string) => void;
	onAddContainer: (containerId: string, direction: "row" | "column") => void;
}) {
	if (typeof item === "string") {
		const Widget = WIDGET_REGISTRY[item];
		return (
			<div className="relative min-w-0">
				{editMode && (
					<button onClick={onRemove} className="absolute -right-2 -top-2 z-20 rounded bg-red-500/20 p-1 text-red-400 hover:bg-red-500/30" title="Remove widget">
						<X className="h-3 w-3" />
					</button>
				)}
				<div className={`glass-panel h-full rounded-2xl p-4 ${editMode ? "border border-indigo-500/30" : ""}`}>
					{editMode && <div className="mb-2 border-b border-white/[0.04] pb-2 text-[10px] uppercase tracking-wider text-white/30 light:text-slate-700">{WIDGET_LABELS[item] ?? item}</div>}
					{Widget ? <Widget /> : <div className="text-xs text-white/20 light:text-slate-700">Unknown widget: {item}</div>}
				</div>
			</div>
		);
	}

	return (
		<div className={`relative rounded-2xl ${editMode ? "border border-dashed border-indigo-500/30 p-3" : ""}`}>
			{editMode && (
				<div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-indigo-300">
					<span>{item.direction} container</span>
					<button onClick={() => onAddContainer(item.id, "row")} className="flex items-center gap-1 rounded bg-white/[0.04] px-2 py-1"><Rows3 className="h-3 w-3" /> row</button>
					<button onClick={() => onAddContainer(item.id, "column")} className="flex items-center gap-1 rounded bg-white/[0.04] px-2 py-1"><Columns3 className="h-3 w-3" /> column</button>
					<button onClick={onRemove} className="ml-auto rounded bg-red-500/20 p-1 text-red-400"><X className="h-3 w-3" /></button>
				</div>
			)}
			<div className={item.direction === "row" ? "grid gap-4 md:grid-cols-2" : "flex flex-col gap-4"}>
				{item.items.map((child, index) => (
					<LayoutNode key={typeof child === "string" ? `${child}:${index}` : child.id} item={child} editMode={editMode} onRemove={() => item.items.splice(index, 1)} onAddWidget={onAddWidget} onAddContainer={onAddContainer} />
				))}
			</div>
			{editMode && (
				<div className="mt-3 flex flex-wrap gap-2">
					{Object.keys(WIDGET_REGISTRY).map((widgetId) => (
						<button key={widgetId} onClick={() => onAddWidget(item.id, widgetId)} className="flex items-center gap-1 rounded bg-white/[0.03] px-2 py-1 text-xs text-white/50 hover:text-indigo-300">
							<Plus className="h-3 w-3" /> {WIDGET_LABELS[widgetId] ?? widgetId}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
