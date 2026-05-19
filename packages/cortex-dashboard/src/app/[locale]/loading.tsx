export default function LocaleLoading() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
			<div className="flex flex-col items-center gap-4">
				<div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500/20 border-t-cyan-400" />
				<p className="text-sm text-white/40">Loading…</p>
			</div>
		</div>
	);
}
