"use client";
/**
 * Chain-verify badge. Calls `/api/audit/verify` with the current window's
 * [from, to] bounds and surfaces the result as a badge. Renders a neutral
 * "—" state when the window is empty (no rows on the page).
 */
import useSWR from "swr";
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

const fetcher = (url: string) =>
	fetch(url).then(async (r) => {
		if (!r.ok) throw new Error(`HTTP ${r.status}`);
		return r.json();
	});

export function AuditChainVerifyBadge({ from, to }: Props) {
	const params = new URLSearchParams();
	const hasWindow = !!(from && to);
	if (hasWindow) {
		params.set("from", new Date(from).toISOString());
		// Bump `to` by 1ms so the verify window is inclusive of the most
		// recent row (verifyChain treats `toTs` as exclusive).
		params.set("to", new Date(new Date(to).getTime() + 1).toISOString());
	}
	const url = hasWindow ? `/api/audit/verify?${params}` : null;

	const { data, error } = useSWR<VerifyResult>(url, fetcher);

	if (!hasWindow) return <Badge variant="secondary">chain: —</Badge>;
	if (!data && !error) return <Badge variant="secondary">chain: …</Badge>;
	if (error) {
		return <Badge variant="destructive">chain: error ({error.message})</Badge>;
	}
	if (data!.valid) {
		return <Badge>chain: ok ({data!.count})</Badge>;
	}
	return (
		<Badge variant="destructive" title={data!.brokenAt?.reason}>
			chain: BROKEN @ id {data!.brokenAt?.id}
		</Badge>
	);
}
