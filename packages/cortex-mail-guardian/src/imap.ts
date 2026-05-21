import tls from "node:tls";
import { once } from "node:events";
import type { MailAccountConfig } from "./config.js";
import { lookupWithFallback } from "./dns.js";

export interface MailMessage {
	uid: number;
	messageId?: string;
	from: string;
	subject: string;
	text: string;
}

export interface MailClient {
	connect(): Promise<void>;
	close(): Promise<void>;
	listInbox(account: MailAccountConfig): Promise<MailMessage[]>;
	moveToTrash(account: MailAccountConfig, uid: number): Promise<string>;
	waitForNewMail(account: MailAccountConfig): Promise<void>;
}

export class TlsImapMailClient implements MailClient {
	private readonly sessions = new Map<string, ImapSession>();

	async connect(): Promise<void> {
		for (const session of this.sessions.values()) await session.ensureConnected();
	}

	async close(): Promise<void> {
		for (const session of this.sessions.values()) await session.close();
	}

	async listInbox(account: MailAccountConfig): Promise<MailMessage[]> {
		const session = await this.session(account);
		await session.select(account.inbox);
		const uids = await session.searchAll();
		const messages: MailMessage[] = [];
		for (const uid of uids) {
			const raw = await session.fetchRaw(uid);
			messages.push({ uid, ...parseRawEmail(raw) });
		}
		return messages;
	}

	async moveToTrash(account: MailAccountConfig, uid: number): Promise<string> {
		const session = await this.session(account);
		await session.select(account.inbox);
		const trash = account.trashMailbox ?? await session.discoverTrashMailbox();
		if (!trash) throw new Error(`Trash mailbox not found for ${account.slug}`);
		await session.move(uid, trash);
		return trash;
	}

	async waitForNewMail(account: MailAccountConfig): Promise<void> {
		const session = await this.session(account);
		await session.select(account.inbox);
		await session.idleOnce();
	}

	private async session(account: MailAccountConfig): Promise<ImapSession> {
		let session = this.sessions.get(account.slug);
		if (!session) {
			session = new ImapSession(account);
			this.sessions.set(account.slug, session);
		}
		await session.ensureConnected();
		return session;
	}
}

class ImapSession {
	private socket?: tls.TLSSocket;
	private tag = 0;
	private buffer = "";

	constructor(private readonly account: MailAccountConfig) {}

	async ensureConnected(): Promise<void> {
		if (this.socket && !this.socket.destroyed) return;
		this.socket = tls.connect({
			host: this.account.host,
			port: this.account.port,
			servername: this.account.host,
			rejectUnauthorized: true,
			lookup: lookupWithFallback as never,
		});
		this.socket.setEncoding("utf8");
		await once(this.socket, "secureConnect");
		await this.readUntil(/^(\* OK|\* PREAUTH)/m);
		await this.command("LOGIN", quote(this.account.username), quote(this.account.password));
	}

	async close(): Promise<void> {
		if (!this.socket || this.socket.destroyed) return;
		try {
			await this.command("LOGOUT");
		} catch {
			// Best effort only.
		}
		this.socket.destroy();
	}

	async select(mailbox: string): Promise<void> {
		await this.command("SELECT", quote(mailbox));
	}

	async searchAll(): Promise<number[]> {
		const output = await this.command("UID", "SEARCH", "ALL");
		const match = output.match(/^\* SEARCH[ \t]*([^\r\n]*)/m);
		if (!match) return [];
		return match[1].trim().split(/\s+/).filter(Boolean).map(Number).filter(Number.isFinite);
	}

	async fetchRaw(uid: number): Promise<string> {
		const output = await this.command("UID", "FETCH", String(uid), "(RFC822)");
		const literalMatch = output.match(/\{(\d+)\}\r?\n([\s\S]*)\r?\n[A-Z0-9]+ OK/);
		if (literalMatch) return literalMatch[2].slice(0, Number(literalMatch[1]));
		return output;
	}

	async discoverTrashMailbox(): Promise<string | undefined> {
		const output = await this.command("LIST", quote(""), quote("*"));
		const lines = output.split(/\r?\n/).filter((line) => line.startsWith("* LIST"));
		for (const line of lines) {
			if (/\\Trash/i.test(line)) return parseMailboxPath(line);
		}
		for (const line of lines) {
			const path = parseMailboxPath(line);
			if (path && /^(trash|deleted items|lixeira)$/i.test(path.split(/[/.]/).pop() ?? path)) return path;
		}
		return undefined;
	}

	async move(uid: number, destination: string): Promise<void> {
		try {
			await this.command("UID", "MOVE", String(uid), quote(destination));
		} catch {
			await this.command("UID", "COPY", String(uid), quote(destination));
			await this.command("UID", "STORE", String(uid), "+FLAGS.SILENT", "(\\Deleted)");
		}
	}

	async idleOnce(): Promise<void> {
		const tag = this.nextTag();
		this.write(`${tag} IDLE\r\n`);
		await this.readUntil(/^\+ /m);
		await new Promise((resolve) => setTimeout(resolve, 29_000));
		this.write("DONE\r\n");
		await this.readUntil(new RegExp(`^${tag} OK`, "m"));
	}

	private async command(command: string, ...args: string[]): Promise<string> {
		const tag = this.nextTag();
		this.write(`${tag} ${[command, ...args].join(" ")}\r\n`);
		const output = await this.readUntil(new RegExp(`^${tag} (OK|NO|BAD)`, "m"));
		if (new RegExp(`^${tag} (NO|BAD)`, "m").test(output)) {
			throw new Error(`IMAP ${command} failed for ${this.account.slug}: ${summarizeImap(output, tag)}`);
		}
		return output;
	}

	private nextTag(): string {
		this.tag += 1;
		return `A${String(this.tag).padStart(4, "0")}`;
	}

	private write(data: string): void {
		if (!this.socket || this.socket.destroyed) throw new Error(`IMAP socket closed for ${this.account.slug}`);
		this.socket.write(data);
	}

	private readUntil(pattern: RegExp): Promise<string> {
		return new Promise((resolve, reject) => {
			const socket = this.socket;
			if (!socket) {
				reject(new Error(`IMAP socket missing for ${this.account.slug}`));
				return;
			}
			const cleanup = () => {
				socket.off("data", onData);
				socket.off("error", onError);
				socket.off("close", onClose);
			};
			const onData = (chunk: string | Buffer) => {
				this.buffer += chunk.toString();
				if (pattern.test(this.buffer)) {
					const out = this.buffer;
					this.buffer = "";
					cleanup();
					resolve(out);
				}
			};
			const onError = (error: Error) => {
				cleanup();
				reject(error);
			};
			const onClose = () => {
				cleanup();
				reject(new Error(`IMAP socket closed for ${this.account.slug}`));
			};
			socket.on("data", onData);
			socket.once("error", onError);
			socket.once("close", onClose);
			if (pattern.test(this.buffer)) onData("");
		});
	}
}

function summarizeImap(output: string, tag: string): string {
	const line = output.split(/\r?\n/).find((item) => item.startsWith(`${tag} `));
	return line?.replace(/\s+/g, " ").slice(0, 240) ?? "server returned failure";
}

function quote(value: string): string {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function parseMailboxPath(line: string): string | undefined {
	const quoted = [...line.matchAll(/"((?:\\"|[^"])*)"/g)].map((match) => match[1].replace(/\\"/g, '"'));
	return quoted.at(-1);
}

function parseRawEmail(raw: string): Omit<MailMessage, "uid"> {
	const [headerRaw, ...bodyParts] = raw.split(/\r?\n\r?\n/);
	const headers = parseHeaders(headerRaw);
	const body = bodyParts.join("\n\n");
	return {
		messageId: headers.get("message-id"),
		from: decodeHeader(headers.get("from") ?? ""),
		subject: decodeHeader(headers.get("subject") ?? ""),
		text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
	};
}

function parseHeaders(raw: string): Map<string, string> {
	const unfolded = raw.replace(/\r?\n[ \t]+/g, " ");
	const headers = new Map<string, string>();
	for (const line of unfolded.split(/\r?\n/)) {
		const idx = line.indexOf(":");
		if (idx <= 0) continue;
		headers.set(line.slice(0, idx).toLowerCase(), line.slice(idx + 1).trim());
	}
	return headers;
}

function decodeHeader(value: string): string {
	return value.replace(/=\?utf-8\?b\?([^?]+)\?=/gi, (_, encoded: string) => {
		try {
			return Buffer.from(encoded, "base64").toString("utf8");
		} catch {
			return "";
		}
	});
}
