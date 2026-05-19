"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function LocaleError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("[dashboard]", error);
	}, [error]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] p-4">
			<div className="w-full max-w-md rounded-xl border border-red-500/30 bg-white/[0.02] p-8 text-center">
				<AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-400" />
				<h2 className="mb-2 text-xl font-bold text-white">Something went wrong</h2>
				<p className="mb-6 text-sm text-white/50">
					{error.message || "An unexpected error occurred."}
				</p>
				<button
					type="button"
					onClick={reset}
					className="rounded-lg bg-red-500/20 px-6 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/30"
				>
					Try again
				</button>
			</div>
		</div>
	);
}
