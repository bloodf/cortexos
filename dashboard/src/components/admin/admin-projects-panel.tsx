"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, FolderOpen } from "lucide-react";

interface ProjectRow {
	id: number;
	slug: string;
	name: string;
	repo_url: string | null;
	primary_pm_account: string | null;
	messaging_mode: "single" | "distributed";
}

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,62}[a-z0-9]$/;

function envFilePath(slug: string): string {
	return `/opt/cortexos/.secrets/projects/${slug}.env`;
}

interface Props {
	initialProjects: ProjectRow[];
}

export function AdminProjectsPanel({ initialProjects }: Props) {
	const [projects, setProjects] = React.useState(initialProjects);
	const [creating, setCreating] = React.useState(false);
	const [editing, setEditing] = React.useState<ProjectRow | null>(null);

	async function save(p: Partial<ProjectRow> & { slug: string; name: string }, isNew: boolean) {
		const method = isNew ? "POST" : "PUT";
		const url = isNew ? "/api/projects" : `/api/projects?slug=${encodeURIComponent(p.slug)}`;
		const res = await fetch(url, {
			method,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(p),
		});
		if (!res.ok) return;
		const data = (await res.json()) as { project: ProjectRow };
		setProjects((prev) => {
			const i = prev.findIndex((r) => r.slug === data.project.slug);
			if (i < 0) return [...prev, data.project];
			return prev.map((r) => (r.slug === data.project.slug ? data.project : r));
		});
		setCreating(false);
		setEditing(null);
	}

	const columns = React.useMemo<ColumnDef<ProjectRow>[]>(
		() => [
			{ accessorKey: "slug", header: "Slug", cell: ({ row }) => <span className="font-mono text-xs">{row.original.slug}</span> },
			{ accessorKey: "name", header: "Name" },
			{ accessorKey: "messaging_mode", header: "Mode" },
			{
				accessorKey: "primary_pm_account",
				header: "Primary PM",
				cell: ({ row }) => row.original.primary_pm_account ?? "—",
			},
			{
				id: "env_path",
				header: "Env File",
				cell: ({ row }) => (
					<span className="font-mono text-xs text-muted-foreground">{envFilePath(row.original.slug)}</span>
				),
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<div className="flex gap-1">
						<Button size="sm" variant="ghost" onClick={() => setEditing(row.original)}>
							Edit
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => {
								window.location.href = `/admin/env-browser?path=${encodeURIComponent(envFilePath(row.original.slug))}`;
							}}
						>
							<FolderOpen className="size-3 mr-1" /> Env
						</Button>
					</div>
				),
			},
		],
		[],
	);

	return (
		<div className="space-y-3">
			<div className="flex justify-end">
				<Button size="sm" onClick={() => setCreating(true)}>
					<Plus className="size-4 mr-1" /> New Project
				</Button>
			</div>

			{projects.length === 0 ? (
				<EmptyState
					title="No projects yet"
					description="Register your first project to wire it into the messaging fabric."
				/>
			) : (
				<DataTable columns={columns} data={projects} />
			)}

			{(creating || editing) && (
				<ProjectEditor
					initial={editing ?? { id: 0, slug: "", name: "", repo_url: null, primary_pm_account: null, messaging_mode: "single" }}
					isNew={creating}
					onClose={() => {
						setCreating(false);
						setEditing(null);
					}}
					onSave={save}
				/>
			)}
		</div>
	);
}

function ProjectEditor({
	initial,
	isNew,
	onClose,
	onSave,
}: {
	initial: ProjectRow;
	isNew: boolean;
	onClose: () => void;
	onSave: (p: ProjectRow, isNew: boolean) => void;
}) {
	const [slug, setSlug] = React.useState(initial.slug);
	const [name, setName] = React.useState(initial.name);
	const [repoUrl, setRepoUrl] = React.useState(initial.repo_url ?? "");
	const [pm, setPm] = React.useState(initial.primary_pm_account ?? "");
	const [mode, setMode] = React.useState(initial.messaging_mode);
	const slugValid = !isNew || SLUG_RE.test(slug);

	return (
		<Dialog open onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{isNew ? "Create project" : `Edit ${initial.name}`}</DialogTitle>
				</DialogHeader>
				<div className="space-y-3">
					{isNew && (
						<div>
							<label className="text-xs font-medium">Slug</label>
							<Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="your-project" />
							{!slugValid && <p className="text-xs text-destructive mt-1">Invalid slug</p>}
						</div>
					)}
					<div>
						<label className="text-xs font-medium">Name</label>
						<Input value={name} onChange={(e) => setName(e.target.value)} />
					</div>
					<div>
						<label className="text-xs font-medium">Repo URL</label>
						<Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repo" />
					</div>
					<div>
						<label className="text-xs font-medium">Primary PM Account</label>
						<Input value={pm} onChange={(e) => setPm(e.target.value)} placeholder="@openclaw-account" />
					</div>
					<div>
						<label className="text-xs font-medium">Messaging Mode</label>
						<select
							className="block h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
							value={mode}
							onChange={(e) => setMode(e.target.value as "single" | "distributed")}
						>
							<option value="single">single</option>
							<option value="distributed">distributed</option>
						</select>
					</div>
					<div className="flex justify-end gap-2 pt-2">
						<Button variant="outline" size="sm" onClick={onClose}>
							Cancel
						</Button>
						<Button
							size="sm"
							disabled={!slugValid || !slug || !name}
							onClick={() =>
								onSave(
									{
										id: initial.id,
										slug,
										name,
										repo_url: repoUrl || null,
										primary_pm_account: pm || null,
										messaging_mode: mode,
									},
									isNew,
								)
							}
						>
							Save
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
