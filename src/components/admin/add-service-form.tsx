"use client";

import { useState } from "react";
import { Upload, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

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

const EMPTY_FORM = {
	slug: "",
	name: "",
	url: "",
	category: "Infrastructure",
	check_type: "http" as (typeof CHECK_TYPES)[number],
	check_target: "",
	enabled: true,
	icon_color: "" as string,
	icon_image: "" as string,
};

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

export function AddServiceForm({
	onSuccess,
	onCancel,
}: {
	onSuccess: (msg: string) => void;
	onCancel: () => void;
}) {
	const [form, setForm] = useState(EMPTY_FORM);
	const [error, setError] = useState("");

	const handleAdd = async () => {
		if (!form.slug || !form.name) {
			setError("Slug and name are required");
			return;
		}
		try {
			const postBody = {
				...form,
				icon_color: form.icon_color || null,
				icon_image: form.icon_image || null,
			};
			const res = await fetch("/api/services", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(postBody),
			});
			if (res.ok) {
				onSuccess("Service added");
			} else {
				const data = await res.json();
				setError(data.error || "Failed to add");
			}
		} catch {
			setError("Error adding service");
		}
	};

	const inputClass =
		"w-full px-3 py-1.5 bg-black/40 border border-white/[0.08] rounded-lg text-xs text-white/90 light:text-slate-700 placeholder:text-white/20 light:text-slate-700 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 transition-all shadow-inner";

	return (
		<motion.div 
			initial={{ opacity: 0, y: -10 }}
			animate={{ opacity: 1, y: 0 }}
			className="mx-6 mt-3 p-4 glass-panel border border-white/[0.08] rounded-xl space-y-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
		>
			{error && <div className="text-xs text-red-400 mb-2">{error}</div>}
			<div className="grid grid-cols-3 gap-3">
				{[
					{ key: "slug" as const, label: "Slug", placeholder: "my-app" },
					{ key: "name" as const, label: "Name", placeholder: "My App" },
					{ key: "url" as const, label: "URL", placeholder: "http://localhost:3000" },
					{ key: "check_target" as const, label: "Health Target", placeholder: "http://localhost:3000/health" },
				].map((f) => (
					<div key={f.key}>
						<label className="block text-[10px] text-white/30 light:text-slate-700 uppercase tracking-wider mb-1">
							{f.label}
						</label>
						<input
							type="text"
							value={form[f.key]}
							onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
							placeholder={f.placeholder}
							className={inputClass}
						/>
					</div>
				))}
				<div>
					<label className="block text-[10px] text-white/30 light:text-slate-700 uppercase tracking-wider mb-1">
						Category
					</label>
					<select
						value={form.category}
						onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
						className={inputClass}
					>
						{CATEGORIES.map((c) => (
							<option key={c} value={c}>{c}</option>
						))}
					</select>
				</div>
				<div>
					<label className="block text-[10px] text-white/30 light:text-slate-700 uppercase tracking-wider mb-1">
						Check Type
					</label>
					<select
						value={form.check_type}
						onChange={(e) => setForm((prev) => ({ ...prev, check_type: e.target.value as (typeof CHECK_TYPES)[number] }))}
						className={inputClass}
					>
						{CHECK_TYPES.map((t) => (
							<option key={t} value={t}>{t}</option>
						))}
					</select>
				</div>
			</div>
			<div className="grid grid-cols-3 gap-3 mt-2">
				<div>
					<label className="block text-[10px] text-white/30 light:text-slate-700 uppercase tracking-wider mb-1">
						Icon Color
					</label>
					<div className="flex items-center gap-2">
						<input
							type="color"
							value={form.icon_color || "#525252"}
							onChange={(e) => setForm((prev) => ({ ...prev, icon_color: e.target.value }))}
							className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
						/>
						{form.icon_color && (
							<span className="text-[10px] text-white/40 light:text-slate-700 font-mono">{form.icon_color}</span>
						)}
					</div>
				</div>
				<div>
					<label className="block text-[10px] text-white/30 light:text-slate-700 uppercase tracking-wider mb-1">
						Icon Image
					</label>
					<div className="flex items-center gap-2">
						<label className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.04] border border-white/[0.08] rounded text-[10px] text-white/50 light:text-slate-700 cursor-pointer hover:bg-white/[0.06]">
							<Upload className="w-3 h-3" />
							Upload
							<input
								type="file"
								accept="image/*"
								className="hidden"
								onChange={async (e) => {
									const file = e.target.files?.[0];
									if (!file) return;
									try {
										const dataUri = await readFileAsDataUri(file);
										setForm((prev) => ({ ...prev, icon_image: dataUri }));
										setError("");
									} catch (err) {
										setError(err instanceof Error ? err.message : "Upload failed");
									}
									e.target.value = "";
								}}
							/>
						</label>
						{form.icon_image && (
							// eslint-disable-next-line @next/next/no-img-element
							<img src={form.icon_image} alt="preview" className="w-6 h-6 rounded object-cover" />
						)}
					</div>
				</div>
				<div className="flex items-end">
					{(form.icon_color || form.icon_image) && (
						<button
							onClick={() => setForm((prev) => ({ ...prev, icon_color: "", icon_image: "" }))}
							className="flex items-center gap-1 px-2 py-1 text-[10px] text-white/30 light:text-slate-700 hover:text-white/50 light:hover:text-slate-950 light:text-slate-700"
						>
							<RotateCcw className="w-3 h-3" />
							Reset Avatar
						</button>
					)}
				</div>
			</div>
			<div className="flex gap-2">
				<button
					onClick={handleAdd}
					className="px-4 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-colors border border-emerald-500/20 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.2)]"
				>
					Save Service
				</button>
				<button
					onClick={onCancel}
					className="px-4 py-1.5 text-white/40 light:text-slate-700 rounded-lg text-xs font-medium hover:text-white/70 light:hover:text-slate-950 light:text-slate-700 hover:bg-white/[0.04] transition-colors"
				>
					Cancel
				</button>
			</div>
		</motion.div>
	);
}
