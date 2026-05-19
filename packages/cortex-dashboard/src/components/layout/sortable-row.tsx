import { useSortable, SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { SortableWidget } from "./sortable-widget";
import type { LayoutRow } from "./types";
import { getRowItems } from "./types";

export function SortableRow({ id, row, rowIndex, editMode, onRemoveWidget, onMoveWidgetRow, onRemoveRow, totalRows }: { id: string; row: LayoutRow; rowIndex: number; editMode: boolean; onRemoveWidget: (widgetIndex: number) => void; onMoveWidgetRow: (widgetIndex: number, dir: -1 | 1) => void; onRemoveRow: () => void; totalRows: number; }) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !editMode });
	const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
	const widgets = getRowItems(row).filter((item): item is string => typeof item === "string");
	const widgetIds = widgets.map((_, i) => `widget:${rowIndex}:${i}`);
	return (
		<div ref={setNodeRef} style={style} className="relative">
			{editMode && <div className="absolute -top-3 left-0 z-20 flex items-center gap-1"><div className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] cursor-grab active:cursor-grabbing" {...attributes} {...listeners}><GripVertical className="w-3 h-3" />Row {rowIndex + 1}</div><button onClick={onRemoveRow} className="w-5 h-5 rounded bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center text-red-400" title="Remove row"><X className="w-3 h-3" /></button></div>}
			<div className={`grid gap-4 ${editMode ? "pt-5" : ""}`} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${widgets.length > 4 ? "200px" : "280px"}), 1fr))` }}>
				<SortableContext items={widgetIds} strategy={horizontalListSortingStrategy}>
					{widgets.map((widgetId, widgetIndex) => <SortableWidget key={widgetIds[widgetIndex]} id={widgetIds[widgetIndex]} widgetId={widgetId} editMode={editMode} onRemove={() => onRemoveWidget(widgetIndex)} onMoveRow={(dir) => onMoveWidgetRow(widgetIndex, dir)} rowIndex={rowIndex} totalRows={totalRows} />)}
				</SortableContext>
			</div>
		</div>
	);
}
