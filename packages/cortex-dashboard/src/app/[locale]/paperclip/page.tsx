import { PaperclipLinkTable } from "@/components/paperclip/link-table";
import { EmptyState } from "@/components/ui/empty-state";
import { loadPaperclipLinks } from "./actions";

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
					description="Set PAPERCLIP_API_URL in /opt/cortexos/.secrets/dashboard.env to enable the Paperclip panel."
				/>
			</div>
		);
	}

	const { rows, warning, error } = await loadPaperclipLinks({});
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
