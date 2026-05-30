"use client";

import * as React from "react";
import { ColorPicker, pickTextColor } from "@/components/ui/color-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus } from "lucide-react";

interface BadgeRow {
	id: number;
	slug: string;
	label: string;
	color: string;
	text_color: string;
}

interface Props {
	initialBadges: BadgeRow[];
}

export function AdminBadgesGrid({ initialBadges }: Props) {
	const [badges, setBadges] = React.useState(initialBadges);
	const [editing, setEditing] = React.useState<BadgeRow | null>(null);
	const [creating, setCreating] = React.useState(false);

	async function save(b: BadgeRow, isNew: boolean) {
		const method = isNew ? "POST" : "PUT";
		const url = isNew ? "/api/badges" : `/api/badges?slug=${encodeURIComponent(b.slug)}`;
		const res = await fetch(url, {
			method,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(b),
		});
		if (!res.ok) return;
		const data = (await res.json()) as { badge: BadgeRow };
		setBadges((prev) => {
			const i = prev.findIndex((p) => p.slug === data.badge.slug);
			if (i < 0) return [...prev, data.badge];
			return prev.map((p) => (p.slug === data.badge.slug ? data.badge : p));
		});
		setEditing(null);
		setCreating(false);
	}

	async function remove(slug: string) {
		const res = await fetch(`/api/badges?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
		if (res.ok) setBadges((prev) => prev.filter((b) => b.slug !== slug));
	}

	return (
		<div className="space-y-4">
			<div className="flex justify-end">
				<Button onClick={() => setCreating(true)} size="sm">
					<Plus className="size-4 mr-1" /> New Badge
				</Button>
			</div>

			{badges.length === 0 ? (
				<EmptyState title="No badges" description="Create the first badge to start tagging services." />
			) : (
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
					{badges.map((b) => (
						<button
							key={b.id}
							type="button"
							onClick={() => setEditing(b)}
							className="rounded-lg border border-border p-3 text-left hover:bg-muted transition-colors"
						>
							<span
								className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
								style={{ backgroundColor: b.color, color: b.text_color }}
							>
								{b.label}
							</span>
							<p className="mt-2 truncate font-mono text-[10px] text-muted-foreground">{b.slug}</p>
						</button>
					))}
				</div>
			)}

			{(editing || creating) && (
				<BadgeEditor
					initial={editing ?? { id: 0, slug: "", label: "", color: "#2563eb", text_color: "#ffffff" }}
					isNew={creating}
					onClose={() => {
						setEditing(null);
						setCreating(false);
					}}
					onSave={save}
					onDelete={editing ? () => remove(editing.slug) : undefined}
				/>
			)}
		</div>
	);
}

function BadgeEditor({
	initial,
	isNew,
	onClose,
	onSave,
	onDelete,
}: {
	initial: BadgeRow;
	isNew: boolean;
	onClose: () => void;
	onSave: (b: BadgeRow, isNew: boolean) => void;
	onDelete?: () => void;
}) {
	const [slug, setSlug] = React.useState(initial.slug);
	const [label, setLabel] = React.useState(initial.label);
	const [color, setColor] = React.useState(initial.color);
	const [textColor, setTextColor] = React.useState(initial.text_color);

	return (
		<Dialog open onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{isNew ? "Create badge" : `Edit ${initial.label}`}</DialogTitle>
				</DialogHeader>
				<div className="space-y-3">
					{isNew && (
						<div>
							<label className="text-xs font-medium">Slug</label>
							<Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. ai" />
						</div>
					)}
					<div>
						<label className="text-xs font-medium">Label</label>
						<Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="AI" />
					</div>
					<div>
						<label className="text-xs font-medium">Color</label>
						<ColorPicker
							value={color}
							onChange={(v) => {
								setColor(v.color);
								setTextColor(pickTextColor(v.color));
							}}
							previewLabel={label || "preview"}
						/>
					</div>
					<div className="flex justify-between gap-2 pt-2">
						{onDelete && (
							<Button variant="destructive" size="sm" onClick={onDelete}>
								Delete
							</Button>
						)}
						<div className="flex gap-2 ml-auto">
							<Button variant="outline" size="sm" onClick={onClose}>
								Cancel
							</Button>
							<Button
								size="sm"
								onClick={() => onSave({ id: initial.id, slug, label, color, text_color: textColor }, isNew)}
								disabled={!slug || !label}
							>
								Save
							</Button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
