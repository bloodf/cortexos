import { EnvBrowser } from "@/components/admin/env-browser";
import { PageHeader } from "@/components/ui/page-header";
import { FileLock2 } from "lucide-react";

export default function AdminEnvBrowserPage() {
	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Env Browser"
				description="Live read/update of VPS env files. Secrets masked by default. Audit-logged."
				icon={<FileLock2 />}
			/>
			<EnvBrowser />
		</div>
	);
}

export const dynamic = "force-dynamic";
