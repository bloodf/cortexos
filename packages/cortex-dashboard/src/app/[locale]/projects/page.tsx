import { listProjects } from "@/lib/db/projects";
import { AdminProjectsPanel } from "@/components/admin/admin-projects-panel";

export default async function ProjectsPage() {
	const projects = await listProjects();
	const safe = projects.map((p) => ({
		id: p.id,
		slug: p.slug,
		name: p.name,
		repo_url: p.repo_url,
		primary_pm_account: p.primary_pm_account,
		messaging_mode: p.messaging_mode,
	}));
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Projects</h1>
			<p className="text-sm text-muted-foreground">
				Operator-registered projects. Bot tokens live on the VPS, never in the dashboard DB.
			</p>
			<AdminProjectsPanel initialProjects={safe} />
		</div>
	);
}

export const dynamic = "force-dynamic";
