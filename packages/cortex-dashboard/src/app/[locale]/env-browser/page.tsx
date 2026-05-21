import { EnvBrowser } from "@/components/admin/env-browser";

export default function EnvBrowserPage() {
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Env Browser</h1>
			<p className="text-sm text-muted-foreground">
				Live read/update of VPS env files. Secrets masked by default. Audit-logged.
			</p>
			<EnvBrowser />
		</div>
	);
}

export const dynamic = "force-dynamic";
