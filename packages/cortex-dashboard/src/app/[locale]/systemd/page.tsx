import { getTranslations } from "next-intl/server";
import { ServerIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SystemdServices } from "@/components/admin/systemd-services";

export default async function SystemdPage() {
	const t = await getTranslations("Infrastructure");
	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title={t("SystemdTitle")}
				description={t("SystemdDescription")}
				icon={<ServerIcon />}
			/>
			<SystemdServices />
		</div>
	);
}

export const dynamic = "force-dynamic";
