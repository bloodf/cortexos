"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Edit, Plus, Trash2 } from "lucide-react";
import { ColorPicker, pickTextColor } from "@/components/ui/color-picker";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";

interface BadgeRow {
	id: number;
	slug: string;
	label: string;
	color: string;
	text_color: string;
	usage_count: number;
}

interface Props {
	initialBadges: BadgeRow[];
}

export function AdminBadgesGrid({ initialBadges }: Props) {
	const [badges, setBadges] = React.useState(initialBadges);
	const [editing, setEditing] = React.useState<BadgeRow | null>(null);
	const [creating, setCreating] = React.useState(false);
	const [globalFilter, setGlobalFilter] = React.useState("");

	async function save(b: BadgeRow, isNew: boolean) {
		const method = isNew ? "POST" : "PUT";
		const url = isNew ? "/api/badges" : `/api/badges?slug=${encodeURIComponent(b.slug)}`;
		const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
		if (!res.ok) return;
		const data = (await res.json()) as { badge: Omit<BadgeRow, "usage_count"> };
		setBadges((prev) => {
			const next = { ...data.badge, usage_count: isNew ? 0 : b.usage_count };
			const i = prev.findIndex((p) => p.slug === next.slug);
			if (i < 0) return [...prev, next];
			return prev.map((p) => (p.slug === next.slug ? next : p));
		});
		setEditing(null);
		setCreating(false);
	}

	async function remove(slug: string) {
		const res = await fetch(`/api/badges?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
		if (res.ok) setBadges((prev) => prev.filter((b) => b.slug !== slug));
	}

	const columns = React.useMemo<ColumnDef<BadgeRow>[]>(() => [
		{
			accessorKey: "label",
			header: "Badge",
			cell: ({ row }) => <div className="space-y-1"><span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium" style={{ backgroundColor: row.original.color, color: row.original.text_color }}>{row.original.label}</span><div className="font-mono text-[10px] text-muted-foreground">{row.original.slug}</div></div>,
		},
		{ accessorKey: "usage_count", header: "Used In", cell: ({ row }) => row.original.usage_count },
		{ id: "edit", header: "Edit", cell: ({ row }) => <IconButton tooltip={`Edit ${row.original.label}`} onClick={() => setEditing(row.original)}><Edit className="size-4" /></IconButton> },
		{ id: "delete", header: "Delete", cell: ({ row }) => <IconButton variant="danger" tooltip={`Delete ${row.original.label}`} onClick={() => remove(row.original.slug)}><Trash2 className="size-4" /></IconButton> },
	], []);

	return (
		<div className="space-y-4">
			<div className="flex justify-end"><Button onClick={() => setCreating(true)} size="sm"><Plus className="size-4 mr-1" /> New Badge</Button></div>
			{badges.length === 0 ? <EmptyState title="No badges" description="Create the first badge to start tagging services." /> : <DataTable columns={columns} data={badges} globalFilter={globalFilter} onGlobalFilterChange={setGlobalFilter} searchPlaceholder="Search badges..." noPagination />}
			{(editing || creating) && <BadgeEditor initial={editing ?? { id: 0, slug: "", label: "", color: "#2563eb", text_color: "#ffffff", usage_count: 0 }} isNew={creating} onClose={() => { setEditing(null); setCreating(false); }} onSave={save} onDelete={editing ? () => remove(editing.slug) : undefined} />}
		</div>
	);
}

function BadgeEditor({ initial, isNew, onClose, onSave, onDelete }: { initial: BadgeRow; isNew: boolean; onClose: () => void; onSave: (b: BadgeRow, isNew: boolean) => void; onDelete?: () => void }) {
	const [slug, setSlug] = React.useState(initial.slug);
	const [label, setLabel] = React.useState(initial.label);
	const [color, setColor] = React.useState(initial.color);
	const [textColor, setTextColor] = React.useState(initial.text_color);
	return <Dialog open onOpenChange={onClose}><DialogContent><DialogHeader><DialogTitle>{isNew ? "Create badge" : `Edit ${initial.label}`}</DialogTitle></DialogHeader><div className="space-y-3">{isNew && <div><label className="text-xs font-medium">Slug</label><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. ai" /></div>}<div><label className="text-xs font-medium">Label</label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="AI" /></div><div><label className="text-xs font-medium">Color</label><ColorPicker value={color} onChange={(v) => { setColor(v.color); setTextColor(pickTextColor(v.color)); }} previewLabel={label || "preview"} /></div><div className="flex justify-between gap-2 pt-2">{onDelete && <Button variant="destructive" size="sm" onClick={onDelete}>Delete</Button>}<div className="flex gap-2 ml-auto"><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={() => onSave({ id: initial.id, slug, label, color, text_color: textColor, usage_count: initial.usage_count }, isNew)} disabled={!slug || !label}>Save</Button></div></div></div></DialogContent></Dialog>;
}
