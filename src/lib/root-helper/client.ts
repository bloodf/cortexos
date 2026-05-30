import net from "net";

export const DEFAULT_HELPER_SOCKET = "/run/cortexos/dashboard-helper.sock";

export interface RootHelperRequest {
	request_id: string;
	command: string;
	argv: string[];
	cwd?: string;
	stdin?: string;
	env?: Record<string, string>;
	timeout_ms?: number;
	dry_run?: boolean;
	requested_by?: string;
	target_scope?: string;
	mutation_class?: string;
	metadata?: Record<string, unknown>;
}

export interface RootHelperResponse {
	request_id: string | null;
	status: string;
	started_at: string | null;
	finished_at: string | null;
	stdout: string;
	stderr: string;
	stdout_sha256: string;
	stderr_sha256: string;
	stdout_bytes: number;
	stderr_bytes: number;
	exit_code: number | null;
	signal: string | null;
	error: string | null;
	journald_cursor?: string | null;
}

export function helperSocketPath(): string {
	return process.env.DASHBOARD_HELPER_SOCKET || DEFAULT_HELPER_SOCKET;
}

export async function sendRootHelperRequest(
	request: RootHelperRequest,
	socketPath = helperSocketPath(),
): Promise<RootHelperResponse> {
	return new Promise((resolve, reject) => {
		const socket = net.createConnection(socketPath);
		let response = "";
		let settled = false;

		const finish = (fn: () => void) => {
			if (settled) return;
			settled = true;
			fn();
		};

		socket.setEncoding("utf-8");
		socket.setTimeout((request.timeout_ms ?? 30000) + 5000);
		socket.on("connect", () => {
			socket.end(`${JSON.stringify(request)}\n`);
		});
		socket.on("data", (chunk) => {
			response += chunk;
		});
		socket.on("end", () => {
			finish(() => {
				try {
					resolve(JSON.parse(response.trim()) as RootHelperResponse);
				} catch (error) {
					reject(error);
				}
			});
		});
		socket.on("timeout", () => {
			socket.destroy(new Error("root helper request timed out"));
		});
		socket.on("error", (error) => {
			finish(() => reject(error));
		});
	});
}
