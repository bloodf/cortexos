"use client";

import { useState } from "react";
import { Upload, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

const selectClass =
	"w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground transition-all outline-none focus:border-ring focus:ring-1 focus:ring-ring";

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

	return (
		<motion.div
			initial={{ opacity: 0, y: -10 }}
			animate={{ opacity: 1, y: 0 }}
			className="mx-6 mt-3 space-y-3 rounded-xl border border-border bg-card p-4"
		>
			{error && <div className="mb-2 text-xs text-destructive">{error}</div>}
			<div className="grid grid-cols-3 gap-3">
				{[
					{ key: "slug" as const, label: "Slug", placeholder: "my-app" },
					{ key: "name" as const, label: "Name", placeholder: "My App" },
					{ key: "url" as const, label: "URL", placeholder: "http://localhost:3000" },
					{ key: "check_target" as const, label: "Health Target", placeholder: "http://localhost:3000/health" },
				].map((f) => (
					<div key={f.key}>
						<label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
							{f.label}
						</label>
						<Input
							type="text"
							value={form[f.key]}
							onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
							placeholder={f.placeholder}
							className="text-xs"
						/>
					</div>
				))}
				<div>
					<label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
						Category
					</label>
					<select
						value={form.category}
						onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
						className={selectClass}
					>
						{CATEGORIES.map((c) => (
							<option key={c} value={c}>{c}</option>
						))}
					</select>
				</div>
				<div>
					<label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
						Check Type
					</label>
					<select
						value={form.check_type}
						onChange={(e) => setForm((prev) => ({ ...prev, check_type: e.target.value as (typeof CHECK_TYPES)[number] }))}
						className={selectClass}
					>
						{CHECK_TYPES.map((t) => (
							<option key={t} value={t}>{t}</option>
						))}
					</select>
				</div>
			</div>
			<div className="mt-2 grid grid-cols-3 gap-3">
				<div>
					<label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
						Icon Color
					</label>
					<div className="flex items-center gap-2">
						<input
							type="color"
							value={form.icon_color || "#525252"}
							onChange={(e) => setForm((prev) => ({ ...prev, icon_color: e.target.value }))}
							className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
						/>
						{form.icon_color && (
							<span className="font-mono text-[10px] text-muted-foreground">{form.icon_color}</span>
						)}
					</div>
				</div>
				<div>
					<label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
						Icon Image
					</label>
					<div className="flex items-center gap-2">
						<label className="flex cursor-pointer items-center gap-1.5 rounded border border-input bg-background px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted">
							<Upload className="h-3 w-3" />
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
							<img src={form.icon_image} alt="preview" className="h-6 w-6 rounded object-cover" />
						)}
					</div>
				</div>
				<div className="flex items-end">
					{(form.icon_color || form.icon_image) && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setForm((prev) => ({ ...prev, icon_color: "", icon_image: "" }))}
							className="text-[10px] text-muted-foreground"
						>
							<RotateCcw className="h-3 w-3" />
							Reset Avatar
						</Button>
					)}
				</div>
			</div>
			<div className="flex gap-2">
				<Button onClick={handleAdd} size="sm">
					Save Service
				</Button>
				<Button onClick={onCancel} variant="ghost" size="sm">
					Cancel
				</Button>
			</div>
		</motion.div>
	);
}
