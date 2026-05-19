
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, ChevronUp, ChevronDown } from "lucide-react";
import { WIDGET_REGISTRY, WIDGET_LABELS } from "@/components/dashboard-widgets";

export function SortableWidget({
	id,
	widgetId,
	editMode,
	onRemove,
	onMoveRow,
	rowIndex,
	totalRows,
}: {
	id: string;
	widgetId: string;
	editMode: boolean;
	onRemove: () => void;
	onMoveRow: (dir: -1 | 1) => void;
	rowIndex: number;
	totalRows: number;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id, disabled: !editMode });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const Widget = WIDGET_REGISTRY[widgetId];

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`relative min-w-0 ${editMode ? "cursor-grab active:cursor-grabbing" : ""}`}
		>
			{editMode && (
				<div className="absolute -top-2 -right-2 z-20 flex items-center gap-0.5">
					{rowIndex > 0 && (
						<button
							onClick={() => onMoveRow(-1)}
							className="w-5 h-5 rounded bg-white/10 light:bg-slate-100 hover:bg-white/20 light:hover:bg-slate-100 light:bg-slate-100 flex items-center justify-center text-white/60 light:text-slate-700"
							title="Move to row above"
						>
							<ChevronUp className="w-3 h-3" />
						</button>
					)}
					{rowIndex < totalRows - 1 && (
						<button
							onClick={() => onMoveRow(1)}
							className="w-5 h-5 rounded bg-white/10 light:bg-slate-100 hover:bg-white/20 light:hover:bg-slate-100 light:bg-slate-100 flex items-center justify-center text-white/60 light:text-slate-700"
							title="Move to row below"
						>
							<ChevronDown className="w-3 h-3" />
						</button>
					)}
					<button
						onClick={onRemove}
						className="w-5 h-5 rounded bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center text-red-400"
						title="Remove widget"
					>
						<X className="w-3 h-3" />
					</button>
				</div>
			)}
			<div
				className={`glass-panel rounded-2xl p-4 h-full ${editMode ? "border border-indigo-500/30" : ""}`}
			>
				{editMode && (
					<div
						className="flex items-center gap-1 mb-2 pb-2 border-b border-white/[0.04]"
						{...attributes}
						{...listeners}
					>
						<GripVertical className="w-3 h-3 text-white/20 light:text-slate-700" />
						<span className="text-[10px] text-white/30 light:text-slate-700 uppercase tracking-wider">
							{WIDGET_LABELS[widgetId] ?? widgetId}
						</span>
					</div>
				)}
				{Widget ? (
					<Widget />
				) : (
					<div className="text-white/20 light:text-slate-700 text-xs">
						Unknown widget: {widgetId}
					</div>
				)}
			</div>
		</div>
	);
}
