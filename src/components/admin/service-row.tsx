"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, XCircle, AlertTriangle, Upload, RotateCcw } from "lucide-react";
import { ServiceLogo } from "@/components/service-logo";

const CATEGORIES = [
	"AI",
	"Infrastructure",
	"Storage",
	"Monitoring",
	"Security",
	"Home",
	"Media",
	"Database",
];
const CHECK_TYPES = ["http", "tcp", "docker", "process", "systemd"] as const;
const MAX_IMAGE_BYTES = 256 * 1024;

function readFileAsDataUri(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		if (file.size > MAX_IMAGE_BYTES) {
			reject(new Error("Image must be under 256KB"));
			return;
		}
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.readAsDataURL(file);
	});
}

type DeletePhase = "idle" | "confirm1" | "confirm2" | "confirm3";

export interface Service {
	id: number;
	slug: string;
	name: string;
	open_url: string;
	health_url: string;
	health_type: "http" | "tcp" | "docker" | "process" | "systemd";
	category: string;
	is_active: boolean;
	icon_color: string | null;
	icon_image: string | null;
}

interface ServiceRowProps {
	svc: Service;
	onUpdate: () => void;
	onError: (msg: string) => void;
	isEditing: boolean;
	onStartEdit: () => void;
	onCancelEdit: () => void;
	isDeleting: boolean;
	deletePhase: DeletePhase;
	onDeleteClick: () => void;
	onCancelDelete: () => void;
}

export function ServiceRow({
	svc,
	onUpdate,
	onError,
	isEditing,
	onStartEdit,
	onCancelEdit,
	isDeleting,
	deletePhase,
	onDeleteClick,
	onCancelDelete,
}: ServiceRowProps) {
	const [editDraft, setEditDraft] = useState<Partial<Service>>({});

	const handleStartEdit = () => {
		setEditDraft({
			name: svc.name,
			slug: svc.slug,
			category: svc.category,
			health_url: svc.health_url,
			health_type: svc.health_type,
			icon_color: svc.icon_color,
			icon_image: svc.icon_image,
		});
		onStartEdit();
	};

	const saveEdit = async () => {
		try {
			const res = await fetch("/api/services", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: svc.id, ...editDraft }),
			});
			if (res.ok) {
				onCancelEdit();
				onUpdate();
			} else {
				const data = await res.json();
				onError(data.error || "Update failed");
			}
		} catch {
			onError("Update failed");
		}
	};

	const toggleActive = async () => {
		try {
			const res = await fetch("/api/services", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: svc.id, is_active: !svc.is_active }),
			});
			if (res.ok) onUpdate();
		} catch {
			onError("Toggle failed");
		}
	};

	const deleteLabel = () => {
		switch (deletePhase) {
			case "confirm1": return "Click again to confirm";
			case "confirm2": return "Last chance — click to delete";
			default: return "";
		}
	};

	const inputClass =
		"w-full px-2 py-1 bg-black/40 border border-white/[0.08] rounded text-xs text-white/90 light:text-slate-700 placeholder:text-white/20 light:text-slate-700 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 transition-all shadow-inner";

	return (
		<tr
			className={`border-b border-white/[0.02] transition-colors ${
				isDeleting
					? "bg-red-500/[0.05]"
					: isEditing
						? "bg-indigo-500/[0.03]"
						: "hover:bg-white/[0.02]"
			}`}
		>
			<td className="py-2.5 pr-3">
				{isEditing ? (
					<div className="flex items-center gap-2">
						<ServiceLogo
							serviceId={svc.slug}
							size={28}
							iconColor={editDraft.icon_color}
							iconImage={editDraft.icon_image}
						/>
						<input
							type="color"
							value={editDraft.icon_color || "#525252"}
							onChange={(e) => setEditDraft((d) => ({ ...d, icon_color: e.target.value }))}
							className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
							title="Icon color"
						/>
						<label className="flex items-center p-1 bg-white/[0.04] rounded cursor-pointer hover:bg-white/[0.06]" title="Upload image">
							<Upload className="w-3 h-3 text-white/40 light:text-slate-700" />
							<input
								type="file"
								accept="image/*"
								className="hidden"
								onChange={async (e) => {
									const file = e.target.files?.[0];
									if (!file) return;
									try {
										const dataUri = await readFileAsDataUri(file);
										setEditDraft((d) => ({ ...d, icon_image: dataUri }));
									} catch (err) {
										onError(err instanceof Error ? err.message : "Upload failed");
									}
									e.target.value = "";
								}}
							/>
						</label>
						{(editDraft.icon_color || editDraft.icon_image) && (
							<button
								onClick={() => setEditDraft((d) => ({ ...d, icon_color: null, icon_image: null }))}
								className="p-1 text-white/30 light:text-slate-700 hover:text-white/50 light:hover:text-slate-950 light:text-slate-700"
								title="Reset avatar"
							>
								<RotateCcw className="w-3 h-3" />
							</button>
						)}
					</div>
				) : (
					<ServiceLogo
						serviceId={svc.slug}
						size={28}
						iconColor={svc.icon_color}
						iconImage={svc.icon_image}
					/>
				)}
			</td>

			<td className="py-2.5 pr-3">
				{isEditing ? (
					<input
						value={editDraft.name ?? ""}
						onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
						className={inputClass}
						autoFocus
					/>
				) : (
					<span className="text-white/70 light:text-slate-700">{svc.name}</span>
				)}
			</td>

			<td className="py-2.5 pr-3">
				{isEditing ? (
					<input
						value={editDraft.slug ?? ""}
						onChange={(e) => setEditDraft((d) => ({ ...d, slug: e.target.value }))}
						className={`${inputClass} font-mono`}
					/>
				) : (
					<span className="font-mono text-white/40 light:text-slate-700">{svc.slug}</span>
				)}
			</td>

			<td className="py-2.5 pr-3">
				{isEditing ? (
					<select
						value={editDraft.category ?? svc.category}
						onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
						className={inputClass}
					>
						{CATEGORIES.map((c) => (
							<option key={c} value={c}>{c}</option>
						))}
					</select>
				) : (
					<span className="text-white/40 light:text-slate-700">{svc.category}</span>
				)}
			</td>

			<td className="py-2.5 pr-3">
				{isEditing ? (
					<select
						value={editDraft.health_type ?? svc.health_type}
						onChange={(e) => setEditDraft((d) => ({ ...d, health_type: e.target.value as Service["health_type"] }))}
						className={inputClass}
					>
						{CHECK_TYPES.map((t) => (
							<option key={t} value={t}>{t}</option>
						))}
					</select>
				) : (
					<span className="text-white/40 light:text-slate-700">{svc.health_type}</span>
				)}
			</td>

			<td className="py-2.5 pr-3">
				{isEditing ? (
					<input
						value={editDraft.health_url ?? svc.health_url}
						onChange={(e) => setEditDraft((d) => ({ ...d, health_url: e.target.value }))}
						className={`${inputClass} font-mono`}
					/>
				) : (
					<span className="font-mono text-white/40 light:text-slate-700 truncate max-w-[200px] block">
						{svc.health_url}
					</span>
				)}
			</td>

			<td className="py-2.5 pr-3">
				<button
					onClick={toggleActive}
					className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
						svc.is_active ? "bg-emerald-500/30" : "bg-white/[0.06]"
					}`}
				>
					<span
						className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
							svc.is_active ? "translate-x-4 bg-emerald-400" : "translate-x-0.5 bg-white/30 light:bg-slate-100"
						}`}
					/>
				</button>
			</td>

			<td className="py-2.5">
				<div className="flex items-center justify-end gap-1">
					{isEditing ? (
						<>
							<button onClick={saveEdit} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors" title="Save">
								<Check className="w-3.5 h-3.5" />
							</button>
							<button onClick={onCancelEdit} className="p-1.5 text-white/30 light:text-slate-700 hover:text-white/60 light:hover:text-slate-950 light:text-slate-700 hover:bg-white/[0.04] rounded transition-colors" title="Cancel">
								<XCircle className="w-3.5 h-3.5" />
							</button>
						</>
					) : (
						<>
							<button onClick={handleStartEdit} className="p-1.5 text-white/20 light:text-slate-700 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors" title="Edit">
								<Pencil className="w-3.5 h-3.5" />
							</button>
							<div className="relative">
								<button
									onClick={onDeleteClick}
									className={`p-1.5 rounded transition-colors ${
										isDeleting ? "text-red-400 bg-red-500/10" : "text-white/20 light:text-slate-700 hover:text-red-400 hover:bg-red-500/10"
									}`}
									title={isDeleting ? deleteLabel() : "Delete"}
								>
									{isDeleting ? <AlertTriangle className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
								</button>
								{isDeleting && (
									<div className="absolute right-0 top-full mt-1 whitespace-nowrap bg-red-500/20 text-red-300 text-[10px] px-2 py-1 rounded z-20">
										{deleteLabel()}
										<button onClick={onCancelDelete} className="ml-2 text-white/30 light:text-slate-700 hover:text-white/60 light:hover:text-slate-950 light:text-slate-700">✕</button>
									</div>
								)}
							</div>
						</>
					)}
				</div>
			</td>
		</tr>
	);
}
