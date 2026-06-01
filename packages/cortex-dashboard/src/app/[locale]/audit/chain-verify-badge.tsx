"use client";
/**
 * Chain-verify badge. Calls `/api/audit/verify` with the current window's
 * [from, to] bounds and surfaces the result as a badge. Renders a neutral
 * "—" state when the window is empty (no rows on the page).
 */
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface VerifyResult {
	valid: boolean;
	count: number;
	brokenAt?: { id: number; occurred_at: string; reason: string };
}

interface Props {
	from: string | null;
	to: string | null;
}

export function AuditChainVerifyBadge({ from, to }: Props) {
	type State =
		| { status: "idle" }
		| { status: "loading" }
		| { status: "ok"; result: VerifyResult }
		| { status: "error"; message: string };

	const [state, setState] = useState<State>({ status: "idle" });

	// Sync state to prop changes — idle when no window, loading when window present.
	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setState(!from || !to ? { status: "idle" } : { status: "loading" });
	}, [from, to]);

	useEffect(() => {
		if (!from || !to) return;

		const params = new URLSearchParams();
		params.set("from", new Date(from).toISOString());
		// Bump `to` by 1ms so the verify window is inclusive of the most
		// recent row (verifyChain treats `toTs` as exclusive).
		params.set("to", new Date(new Date(to).getTime() + 1).toISOString());
		const ctrl = new AbortController();
		fetch(`/api/audit/verify?${params}`, { signal: ctrl.signal })
			.then(async (r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				return r.json();
			})
			.then((result: VerifyResult) => setState({ status: "ok", result }))
			.catch((e: unknown) => {
				if ((e as Error).name === "AbortError") return;
				setState({ status: "error", message: (e as Error).message });
			});
		return () => ctrl.abort();
	}, [from, to]);

	if (state.status === "idle") return <Badge variant="secondary">chain: —</Badge>;
	if (state.status === "loading") return <Badge variant="secondary">chain: …</Badge>;
	if (state.status === "error") {
		return <Badge variant="destructive">chain: error ({state.message})</Badge>;
	}
	if (state.result.valid) {
		return <Badge>chain: ok ({state.result.count})</Badge>;
	}
	return (
		<Badge variant="destructive" title={state.result.brokenAt?.reason}>
			chain: BROKEN @ id {state.result.brokenAt?.id}
		</Badge>
	);
}
