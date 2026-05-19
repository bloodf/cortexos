"use client";

import { useState } from "react";
import { Columns3, Pencil, Plus, RotateCcw, Rows3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WIDGET_LABELS, WIDGET_REGISTRY } from "@/components/dashboard-widgets";
import type { LayoutConfig, LayoutDirection, LayoutItem } from "./types";
import { getRowItems, rowFromItems } from "./types";
import { SortableWidget } from "./sortable-widget";

export interface DraggableLayoutProps {
	layout: LayoutConfig;
	onChange: (layout: LayoutConfig) => void;
}

const DEFAULT_LAYOUT: LayoutConfig = {
	rows: [
		rowFromItems(["cpu-gauge", "memory-gauge", "storage-gauge"]),
		rowFromItems(["service-online", "service-offline", "service-idle"]),
		rowFromItems(["database-ops", "monitoring-ops", "container-ops"]),
		rowFromItems([{ type: "container", id: "perf-container", direction: "row", items: ["live-performance", { type: "container", id: "side-container", direction: "column", items: ["top-processes", "network-graph"] }] }]),
		rowFromItems(["total-download", "total-upload"]),
	],
};

function makeContainer(direction: LayoutDirection): LayoutItem {
	return { type: "container", id: `container-${Date.now()}-${Math.random().toString(16).slice(2)}`, direction, items: [] };
}

function updateInItems(items: LayoutItem[], containerId: string, updater: (items: LayoutItem[]) => LayoutItem[]): LayoutItem[] {
	return items.map((item) => {
		if (typeof item === "string") return item;
		if (item.id === containerId) return { ...item, items: updater(item.items) };
		return { ...item, items: updateInItems(item.items, containerId, updater) };
	});
}

function removeAtPath(items: LayoutItem[], path: number[]): LayoutItem[] {
	if (path.length === 1) return items.filter((_, index) => index !== path[0]);
	return items.map((item, index) => {
		if (index !== path[0] || typeof item === "string") return item;
		return { ...item, items: removeAtPath(item.items, path.slice(1)) };
	});
}

function moveRow(rows: LayoutConfig["rows"], from: number, to: number) {
	const next = [...rows];
	const [row] = next.splice(from, 1);
	next.splice(to, 0, row);
	return next;
}

function LayoutNode({ item, editMode, path, onRemove, onAddWidget, onAddContainer }: { item: LayoutItem; editMode: boolean; path: number[]; onRemove: (path: number[]) => void; onAddWidget: (containerId: string, widgetId: string) => void; onAddContainer: (containerId: string, direction: LayoutDirection) => void }) {
	if (typeof item === "string") {
		return <SortableWidget id={`widget:${path.join(":")}`} widgetId={item} editMode={false} onRemove={() => onRemove(path)} onMoveRow={() => {}} rowIndex={0} totalRows={1} />;
	}
	return (
		<div className={`relative rounded-2xl ${editMode ? "border border-dashed border-indigo-500/30 p-3" : ""}`}>
			{editMode && (
				<div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-indigo-300">
					<span className="uppercase tracking-wider">{item.direction} container</span>
					<Button type="button" size="sm" variant="outline" onClick={() => onAddContainer(item.id, "row")}><Rows3 className="mr-1 h-3 w-3" /> Row</Button>
					<Button type="button" size="sm" variant="outline" onClick={() => onAddContainer(item.id, "column")}><Columns3 className="mr-1 h-3 w-3" /> Column</Button>
					<Button type="button" size="sm" variant="destructive" onClick={() => onRemove(path)} className="ml-auto"><X className="h-3 w-3" /></Button>
				</div>
			)}
			<div className={item.direction === "row" ? "grid gap-4 md:grid-cols-2" : "flex flex-col gap-4"}>
				{item.items.map((child, index) => <LayoutNode key={typeof child === "string" ? `${child}:${index}` : child.id} item={child} editMode={editMode} path={[...path, index]} onRemove={onRemove} onAddWidget={onAddWidget} onAddContainer={onAddContainer} />)}
			</div>
			{editMode && <AddWidgetStrip onAdd={(widgetId) => onAddWidget(item.id, widgetId)} />}
		</div>
	);
}

function AddWidgetStrip({ onAdd }: { onAdd: (widgetId: string) => void }) {
	return <div className="mt-3 flex flex-wrap gap-2">{Object.keys(WIDGET_REGISTRY).map((widgetId) => <Button key={widgetId} type="button" size="sm" variant="outline" onClick={() => onAdd(widgetId)}><Plus className="mr-1 h-3 w-3" />{WIDGET_LABELS[widgetId] ?? widgetId}</Button>)}</div>;
}

export function DraggableLayout({ layout, onChange }: DraggableLayoutProps) {
	const [editMode, setEditMode] = useState(false);
	const rows = layout.rows?.length ? layout.rows : DEFAULT_LAYOUT.rows;

	function changeRows(nextRows: LayoutConfig["rows"]) { onChange({ rows: nextRows }); }
	function addWidgetToRow(rowIndex: number, widgetId: string) { changeRows(rows.map((row, i) => i === rowIndex ? rowFromItems([...getRowItems(row), widgetId]) : row)); }
	function addContainerToRow(rowIndex: number, direction: LayoutDirection) { changeRows(rows.map((row, i) => i === rowIndex ? rowFromItems([...getRowItems(row), makeContainer(direction)]) : row)); }
	function addWidgetToContainer(containerId: string, widgetId: string) { changeRows(rows.map((row) => rowFromItems(updateInItems(getRowItems(row), containerId, (items) => [...items, widgetId])))); }
	function addContainerToContainer(containerId: string, direction: LayoutDirection) { changeRows(rows.map((row) => rowFromItems(updateInItems(getRowItems(row), containerId, (items) => [...items, makeContainer(direction)])))); }
	function removeItem(rowIndex: number, path: number[]) { changeRows(rows.map((row, i) => i === rowIndex ? rowFromItems(removeAtPath(getRowItems(row), path)) : row).filter((row) => getRowItems(row).length > 0)); }

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-end gap-2">
				<Button type="button" size="sm" variant={editMode ? "default" : "outline"} onClick={() => setEditMode(!editMode)}><Pencil className="mr-1 h-3.5 w-3.5" />{editMode ? "Done" : "Edit Layout"}</Button>
				{editMode && <Button type="button" size="sm" variant="outline" onClick={() => onChange(DEFAULT_LAYOUT)}><RotateCcw className="mr-1 h-3.5 w-3.5" />Reset</Button>}
			</div>

			<div className="space-y-6">
				{rows.map((row, rowIndex) => (
					<div key={rowIndex} className="relative">
						{editMode && <div className="mb-2 flex flex-wrap gap-2"><span className="rounded bg-indigo-500/20 px-2 py-1 text-xs text-indigo-300">Row {rowIndex + 1}</span><Button type="button" size="sm" variant="outline" disabled={rowIndex === 0} onClick={() => changeRows(moveRow(rows, rowIndex, rowIndex - 1))}>Up</Button><Button type="button" size="sm" variant="outline" disabled={rowIndex === rows.length - 1} onClick={() => changeRows(moveRow(rows, rowIndex, rowIndex + 1))}>Down</Button><Button type="button" size="sm" variant="destructive" onClick={() => changeRows(rows.filter((_, i) => i !== rowIndex))}>Remove row</Button></div>}
						<div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
							{getRowItems(row).map((item, index) => <LayoutNode key={typeof item === "string" ? `${item}:${index}` : item.id} item={item} editMode={editMode} path={[index]} onRemove={(path) => removeItem(rowIndex, path)} onAddWidget={addWidgetToContainer} onAddContainer={addContainerToContainer} />)}
						</div>
						{editMode && <div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => addContainerToRow(rowIndex, "row")}><Rows3 className="mr-1 h-3 w-3" />Add row container</Button><Button type="button" size="sm" variant="outline" onClick={() => addContainerToRow(rowIndex, "column")}><Columns3 className="mr-1 h-3 w-3" />Add column container</Button><AddWidgetStrip onAdd={(widgetId) => addWidgetToRow(rowIndex, widgetId)} /></div>}
					</div>
				))}
			</div>
			{editMode && <Button type="button" onClick={() => changeRows([...rows, rowFromItems([])])}><Plus className="mr-1 h-4 w-4" />New Row</Button>}
		</div>
	);
}
