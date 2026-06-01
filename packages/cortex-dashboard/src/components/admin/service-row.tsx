"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, XCircle, AlertTriangle, Upload, RotateCcw } from "lucide-react";
import { ServiceLogo } from "@/components/service-logo";
import { Switch } from "@/components/ui/switch";

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
		"w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground transition-all outline-none focus:border-ring focus:ring-1 focus:ring-ring";

	return (
		<tr
			className={`border-b border-border transition-colors ${
				isDeleting
					? "bg-destructive/5"
					: isEditing
						? "bg-primary/5"
						: "hover:bg-muted/50"
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
							className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent"
							title="Icon color"
						/>
						<label className="flex cursor-pointer items-center rounded bg-muted p-1 hover:bg-muted/70" title="Upload image">
							<Upload className="h-3 w-3 text-muted-foreground" />
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
								type="button"
								onClick={() => setEditDraft((d) => ({ ...d, icon_color: null, icon_image: null }))}
								className="p-1 text-muted-foreground hover:text-foreground"
								title="Reset avatar"
							>
								<RotateCcw className="h-3 w-3" />
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
					<span className="text-foreground">{svc.name}</span>
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
					<span className="font-mono text-muted-foreground">{svc.slug}</span>
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
					<span className="text-muted-foreground">{svc.category}</span>
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
					<span className="text-muted-foreground">{svc.health_type}</span>
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
					<span className="block max-w-[200px] truncate font-mono text-muted-foreground">
						{svc.health_url}
					</span>
				)}
			</td>

			<td className="py-2.5 pr-3">
				<Switch
					checked={svc.is_active}
					onCheckedChange={toggleActive}
					aria-label={`Toggle ${svc.name}`}
				/>
			</td>

			<td className="py-2.5">
				<div className="flex items-center justify-end gap-1">
					{isEditing ? (
						<>
							<button type="button" onClick={saveEdit} className="rounded p-1.5 text-success transition-colors hover:bg-success/10" title="Save">
								<Check className="h-3.5 w-3.5" />
							</button>
							<button type="button" onClick={onCancelEdit} className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Cancel">
								<XCircle className="h-3.5 w-3.5" />
							</button>
						</>
					) : (
						<>
							<button type="button" onClick={handleStartEdit} className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary" title="Edit">
								<Pencil className="h-3.5 w-3.5" />
							</button>
							<div className="relative">
								<button
									type="button"
									onClick={onDeleteClick}
									className={`rounded p-1.5 transition-colors ${
										isDeleting ? "bg-destructive/10 text-destructive" : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
									}`}
									title={isDeleting ? deleteLabel() : "Delete"}
								>
									{isDeleting ? <AlertTriangle className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
								</button>
								{isDeleting && (
									<div className="absolute right-0 top-full z-20 mt-1 whitespace-nowrap rounded bg-destructive/20 px-2 py-1 text-[10px] text-destructive">
										{deleteLabel()}
										<button type="button" onClick={onCancelDelete} className="ml-2 text-muted-foreground hover:text-foreground">✕</button>
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
