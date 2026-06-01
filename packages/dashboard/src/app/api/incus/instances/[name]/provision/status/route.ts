/**
 * /api/incus/instances/[name]/provision/status — poll provisioning progress.
 *
 * Tails the per-request on-disk JSON progress log written by the canonical
 * script, plus the current DB status. Read-only (hostExecFile cat). The
 * request id is taken from the saved row's last_request_id (set when provision
 * started), or from the ?requestId= query param when present.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { hostExecFile } from "@/lib/host-exec";
import { getIncusInstance, SAFE_NAME_RE } from "@/lib/db/incus-instances";

const PROGRESS_DIR =
	process.env.CORTEX_INCUS_PROGRESS_DIR ?? "/run/cortexos/incus-provision";
const REQUEST_ID_RE = /^[a-zA-Z0-9-]{1,64}$/;

interface ProgressStep {
	step: string;
	status: string;
	n?: number;
	total?: number;
	detail?: string;
}

async function readSteps(requestId: string): Promise<ProgressStep[]> {
	if (!requestId || !REQUEST_ID_RE.test(requestId)) return [];
	try {
		const { stdout } = await hostExecFile("cat", [`${PROGRESS_DIR}/${requestId}.log`], {
			timeout: 5000,
		});
		const steps: ProgressStep[] = [];
		for (const line of stdout.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed.startsWith("{")) continue;
			try {
				steps.push(JSON.parse(trimmed) as ProgressStep);
			} catch {
				/* skip malformed line */
			}
		}
		return steps;
	} catch {
		return [];
	}
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ name: string }> },
) {
	const auth = await requireAdmin(request, { tool: "incus.instances.status" });
	if (auth.error) return auth.error;

	const { name } = await params;
	if (!SAFE_NAME_RE.test(name)) {
		return NextResponse.json({ error: "Invalid name" }, { status: 400 });
	}

	const row = await getIncusInstance(name);
	if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const queryId = new URL(request.url).searchParams.get("requestId");
	const requestId = queryId ?? row.last_request_id ?? "";
	const steps = await readSteps(requestId);

	return NextResponse.json({ data: { status: row.status, requestId, steps } });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
