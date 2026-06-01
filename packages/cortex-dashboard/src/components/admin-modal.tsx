"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { X, Plus, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SkeletonTable } from "@/components/skeleton";
import { AddServiceForm } from "./admin/add-service-form";
import { ServiceRow, type Service } from "./admin/service-row";
import { useLocalStorage } from "@/hooks/use-local-storage";

type SortField = "name" | "slug" | "category" | "is_active";
type SortDirection = "asc" | "desc";
interface SortState {
	field: SortField;
	direction: SortDirection;
}

interface AdminModalProps {
	open: boolean;
	onClose: () => void;
	onUpdate: () => void;
}

type DeletePhase = "idle" | "confirm1" | "confirm2" | "confirm3";

const thClass = "pb-3 pr-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap";

interface SortHeaderProps {
	field: SortField;
	sortState: SortState;
	onSort: (field: SortField) => void;
	children: React.ReactNode;
}

function SortHeader({ field, sortState, onSort, children }: SortHeaderProps) {
	return (
		<th
			className={`${thClass} cursor-pointer select-none hover:text-foreground transition-colors`}
			onClick={() => onSort(field)}
		>
			<span className="inline-flex items-center gap-1">
				{children}
				{sortState.field === field ? (
					sortState.direction === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
				) : (
					<ArrowUpDown className="w-3 h-3 opacity-30" />
				)}
			</span>
		</th>
	);
}

export function AdminModal({ open, onClose, onUpdate }: AdminModalProps) {
	const [services, setServices] = useState<Service[]>([]);
	const [loading, setLoading] = useState(true);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [showAdd, setShowAdd] = useState(false);
	const [deleteState, setDeleteState] = useState<{ id: number | null; phase: DeletePhase }>({ id: null, phase: "idle" });
	const [message, setMessage] = useState("");
	const mountedRef = useRef(true);
	const modalRef = useRef<HTMLDivElement>(null);
	const [sortState, setSortState] = useLocalStorage<SortState>("cortex-admin-sort", { field: "name", direction: "asc" });

	const sortedServices = useMemo(() => {
		const sorted = [...services].sort((a, b) => {
			const { field, direction } = sortState;
			let cmp = 0;
			if (field === "is_active") {
				cmp = (a.is_active === b.is_active) ? 0 : a.is_active ? -1 : 1;
			} else {
				cmp = String(a[field]).localeCompare(String(b[field]));
			}
			return direction === "asc" ? cmp : -cmp;
		});
		return sorted;
	}, [services, sortState]);

	const handleSort = (field: SortField) => {
		setSortState((prev) => ({
			field,
			direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
		}));
	};

	const fetchServices = useCallback(async () => {
		try {
			const res = await fetch("/api/services?raw=1", { cache: "no-store" });
			if (res.ok && mountedRef.current) {
				setServices((await res.json()).services);
			}
		} catch {
			if (mountedRef.current) setMessage("Failed to load services");
		}
		if (mountedRef.current) setLoading(false);
	}, []);

	useEffect(() => {
		mountedRef.current = true;
		if (!open) {
			return () => {
				mountedRef.current = false;
			};
		}
		(async () => {
			try {
				const res = await fetch("/api/services?raw=1", { cache: "no-store" });
				if (!mountedRef.current) return;
				if (res.ok) {
					const json = await res.json();
					if (mountedRef.current) setServices(json.services);
				}
			} catch {
				if (mountedRef.current) setMessage("Failed to load services");
			} finally {
				if (mountedRef.current) setLoading(false);
			}
		})();
		return () => {
			mountedRef.current = false;
		};
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (editingId) {
					setEditingId(null);
				} else if (deleteState.phase !== "idle") {
					setDeleteState({ id: null, phase: "idle" });
				} else {
					onClose();
				}
			}
		};
		window.addEventListener("keydown", handleEsc);
		return () => window.removeEventListener("keydown", handleEsc);
	}, [open, editingId, deleteState.phase, onClose]);

	const handleDeleteClick = (id: number) => {
		if (deleteState.id === id) {
			const nextPhase: Record<DeletePhase, DeletePhase> = {
				idle: "confirm1",
				confirm1: "confirm2",
				confirm2: "confirm3",
				confirm3: "confirm3",
			};
			const next = nextPhase[deleteState.phase];
			if (next === "confirm3") {
				performDelete(id);
				return;
			}
			setDeleteState({ id, phase: next });
		} else {
			setDeleteState({ id, phase: "confirm1" });
		}
	};

	const performDelete = async (id: number) => {
		try {
			const res = await fetch(`/api/services?id=${id}`, { method: "DELETE" });
			if (res.ok) {
				setMessage("Deleted");
				setDeleteState({ id: null, phase: "idle" });
				fetchServices();
				onUpdate();
			}
		} catch {
			setMessage("Delete failed");
		}
	};

	return (
		<AnimatePresence>
			{open && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl"
					onClick={(e) => {
						if (e.target === e.currentTarget) onClose();
					}}
				>
					<motion.div
						initial={{ scale: 0.95, opacity: 0, y: 20 }}
						animate={{ scale: 1, opacity: 1, y: 0 }}
						exit={{ scale: 0.95, opacity: 0, y: 20 }}
						ref={modalRef}
						className="relative w-[95vw] max-w-[1400px] max-h-[85vh] glass-panel rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
					>
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
					<h2 className="text-sm font-semibold text-white/80 light:text-slate-700">Service Management</h2>
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => {
								setShowAdd(!showAdd);
								setEditingId(null);
							}}
							className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg text-xs hover:bg-indigo-500/30 transition-colors"
						>
							<Plus className="w-3.5 h-3.5" />
							Add Service
						</button>
						<button type="button" onClick={onClose} className="text-white/30 light:text-slate-700 hover:text-white/60 light:hover:text-slate-950 light:text-slate-700 transition-colors">
							<X className="w-5 h-5" />
						</button>
					</div>
				</div>

				{/* Message */}
				{message && (
					<div
						className="mx-6 mt-3 text-xs text-white/60 light:text-slate-700 bg-white/[0.03] rounded-lg px-3 py-2 cursor-pointer"
						onClick={() => setMessage("")}
					>
						{message}
					</div>
				)}

				{/* Add form */}
				{showAdd && (
					<AddServiceForm
						onSuccess={(msg) => {
							setMessage(msg);
							setShowAdd(false);
							fetchServices();
							onUpdate();
						}}
						onCancel={() => setShowAdd(false)}
					/>
				)}

				{/* Table */}
				<div className="flex-1 overflow-auto px-6 py-4">
					{loading ? (
						<SkeletonTable rows={8} cols={7} />
					) : (
						<table className="w-full text-left">
							<thead className="sticky top-0 z-10 backdrop-blur-xl bg-background/40">
						<tr className="border-b border-border">
							<th className={thClass}>Avatar</th>
							<SortHeader field="name" sortState={sortState} onSort={handleSort}>Name</SortHeader>
							<SortHeader field="slug" sortState={sortState} onSort={handleSort}>Slug</SortHeader>
							<SortHeader field="category" sortState={sortState} onSort={handleSort}>Category</SortHeader>
							<th className={thClass}>Status</th>
							<th className={thClass}>Health Target</th>
							<SortHeader field="is_active" sortState={sortState} onSort={handleSort}>Enabled</SortHeader>
							<th className={`${thClass} text-right`}>Actions</th>
						</tr>
					</thead>
							<tbody className="text-xs">
								{sortedServices.map((svc) => (
									<ServiceRow
										key={svc.id}
										svc={svc}
										onUpdate={() => {
											fetchServices();
											onUpdate();
										}}
										onError={setMessage}
										isEditing={editingId === svc.id}
										onStartEdit={() => {
											setEditingId(svc.id);
											setDeleteState({ id: null, phase: "idle" });
										}}
										onCancelEdit={() => setEditingId(null)}
										isDeleting={deleteState.id === svc.id && deleteState.phase !== "idle"}
										deletePhase={deleteState.phase}
										onDeleteClick={() => handleDeleteClick(svc.id)}
										onCancelDelete={() => setDeleteState({ id: null, phase: "idle" })}
									/>
								))}
							</tbody>
						</table>
					)}
					{!loading && services.length === 0 && (
						<div className="text-center text-white/20 light:text-slate-700 py-12 text-sm">No services configured</div>
					)}
				</div>
			</motion.div>
		</motion.div>
		)}
		</AnimatePresence>
	);
}
