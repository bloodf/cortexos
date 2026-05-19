import { execSync, execFile } from "child_process";
import { existsSync } from "fs";
import { promisify } from "util";

export const IN_CONTAINER = existsSync("/.dockerenv");

const execFileAsync = promisify(execFile);

export function hostExec(cmd: string, timeout = 5000): string {
	if (!IN_CONTAINER) {
		return execSync(cmd, { encoding: "utf-8", timeout });
	}
	const escaped = cmd.replace(/'/g, "'\\''");
	return execSync(`nsenter --target 1 --mount --net -- sh -c '${escaped}'`, {
		encoding: "utf-8",
		timeout,
	});
}

export async function hostExecFile(
	bin: string,
	args: string[],
	opts: { timeout?: number; maxBuffer?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
	const timeout = opts.timeout ?? 10000;
	const maxBuffer = opts.maxBuffer ?? 5 * 1024 * 1024;
	if (IN_CONTAINER) {
		const { stdout, stderr } = await execFileAsync(
			"nsenter",
			["--target", "1", "--mount", "--", bin, ...args],
			{ encoding: "utf-8", timeout, maxBuffer },
		);
		return { stdout, stderr };
	}
	const { stdout, stderr } = await execFileAsync(bin, args, {
		encoding: "utf-8",
		timeout,
		maxBuffer,
	});
	return { stdout, stderr };
}
