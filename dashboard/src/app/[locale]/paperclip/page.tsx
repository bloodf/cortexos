import { headers } from "next/headers";
import {
	PaperclipLinkTable,
	type PaperclipLinkRow,
} from "@/components/paperclip/link-table";
import { EmptyState } from "@/components/ui/empty-state";

async function fetchLinks(): Promise<{
	rows: PaperclipLinkRow[];
	warning?: string;
	error?: string;
}> {
	try {
		const h = await headers();
		const host = h.get("host") ?? "127.0.0.1:3080";
		const proto = h.get("x-forwarded-proto") ?? "http";
		const res = await fetch(`${proto}://${host}/api/paperclip/links`, {
			cache: "no-store",
			headers: { cookie: h.get("cookie") ?? "" },
		});
		if (!res.ok) {
			return { rows: [], error: `links api ${res.status}` };
		}
		const body = (await res.json()) as {
			rows?: PaperclipLinkRow[];
			warning?: string;
		};
		return { rows: body.rows ?? [], warning: body.warning };
	} catch (err) {
		const msg = err instanceof Error ? err.message : "fetch failed";
		return { rows: [], error: msg };
	}
}

export default async function PaperclipPage() {
	const apiUrl = process.env.PAPERCLIP_API_URL;

	if (!apiUrl) {
		return (
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold text-white/90 light:text-slate-800">
					Paperclip
				</h1>
				<EmptyState
					title="Paperclip integration disabled"
					description="Set PAPERCLIP_API_URL in /opt/cortexos/secrets/dashboard.env to enable the Paperclip panel."
				/>
			</div>
		);
	}

	const { rows, warning, error } = await fetchLinks();
	const boardUrl = `${apiUrl.replace(/\/$/, "")}/board`;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold text-white/90 light:text-slate-800">
					Paperclip
				</h1>
				<p className="text-sm text-muted-foreground mt-1">
					Recent Paperclip ↔ CortexOS ticket links and the live board.
				</p>
			</div>

			{warning && (
				<div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
					{warning}
				</div>
			)}
			{error && (
				<div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
					{error}
				</div>
			)}

			<section className="space-y-3">
				<h2 className="text-lg font-semibold text-foreground">Ticket links</h2>
				<PaperclipLinkTable rows={rows} />
			</section>

			<section className="space-y-3">
				<h2 className="text-lg font-semibold text-foreground">Board</h2>
				<div className="overflow-hidden rounded-xl border border-border bg-background/40">
					<iframe
						src={boardUrl}
						title="Paperclip board"
						className="h-[640px] w-full"
						sandbox="allow-same-origin allow-scripts allow-forms"
					/>
				</div>
			</section>
		</div>
	);
}

export const dynamic = "force-dynamic";
