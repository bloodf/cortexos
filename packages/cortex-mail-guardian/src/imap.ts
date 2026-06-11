import tls from 'node:tls';
import { once } from 'node:events';
import type { MailAccountConfig } from './config.js';
import lookupWithFallback from './dns.js';

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
  moveToReview(account: MailAccountConfig, uid: number): Promise<string>;
  moveToInbox(account: MailAccountConfig, uid: number, options?: MoveOptions): Promise<string>;
  moveToTrash(account: MailAccountConfig, uid: number, options?: MoveOptions): Promise<string>;
  waitForNewMail(account: MailAccountConfig): Promise<void>;
}

export interface MoveOptions {
  sourceMailbox?: string;
  messageId?: string;
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function parseMailboxPath(line: string): string | undefined {
  const quoted = [...line.matchAll(/"((?:\\"|[^"])*)"/g)].map((match) =>
    match[1].replace(/\\"/g, '"'),
  );
  if (quoted.length > 0) return quoted.at(-1);
  return line.trim().split(/\s+/).at(-1);
}

function parseHeaders(raw: string): Map<string, string> {
  const unfolded = raw.replace(/\r?\n[ \t]+/g, ' ');
  const headers = new Map<string, string>();
  unfolded.split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf(':');
    if (idx > 0) {
      headers.set(line.slice(0, idx).toLowerCase(), line.slice(idx + 1).trim());
    }
  });
  return headers;
}

function decodeHeader(value: string): string {
  return value.replace(/=\?utf-8\?b\?([^?]+)\?=/gi, (_, encoded: string) => {
    try {
      return Buffer.from(encoded, 'base64').toString('utf8');
    } catch {
      return '';
    }
  });
}

function parseRawEmail(raw: string): Omit<MailMessage, 'uid'> {
  const [headerRaw, ...bodyParts] = raw.split(/\r?\n\r?\n/);
  const headers = parseHeaders(headerRaw);
  const body = bodyParts.join('\n\n');
  return {
    messageId: headers.get('message-id'),
    from: decodeHeader(headers.get('from') ?? ''),
    subject: decodeHeader(headers.get('subject') ?? ''),
    text: body
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  };
}

function summarizeImap(output: string, tag: string): string {
  const line = output.split(/\r?\n/).find((item) => item.startsWith(`${tag} `));
  return line?.replace(/\s+/g, ' ').slice(0, 240) ?? 'server returned failure';
}

class ImapSession {
  private socket?: tls.TLSSocket;
  private tag = 0;
  private buffer = '';

  constructor(private readonly account: MailAccountConfig) {}

  async ensureConnected(): Promise<void> {
    if (this.socket && !this.socket.destroyed) return;
    const socket = tls.connect({
      host: this.account.host,
      port: this.account.port,
      servername: this.account.host,
      rejectUnauthorized: true,
      lookup: lookupWithFallback,
    });
    this.socket = socket;
    socket.setTimeout(30_000);
    socket.setEncoding('utf8');
    const timeoutError = new Error(`IMAP connection timed out for ${this.account.slug}`);
    socket.once('timeout', () => socket.destroy(timeoutError));
    await Promise.race([
      once(socket, 'secureConnect'),
      once(socket, 'error').then(([error]) => {
        throw error;
      }),
    ]);
    await this.readUntil(/^(\* OK|\* PREAUTH)/m);
    await this.command('LOGIN', quote(this.account.username), quote(this.account.password));
    socket.on('error', () => {
      // Later command/read paths handle closed sockets; avoid process-level unhandled errors.
    });
  }

  async close(): Promise<void> {
    if (!this.socket || this.socket.destroyed) return;
    try {
      await this.command('LOGOUT');
    } catch {
      // Best effort only.
    }
    this.socket.destroy();
  }

  async select(mailbox: string): Promise<void> {
    await this.command('SELECT', quote(mailbox));
  }

  async searchAll(): Promise<number[]> {
    const output = await this.command('UID', 'SEARCH', 'ALL');
    const match = output.match(/^\* SEARCH[ \t]*([^\r\n]*)/m);
    if (!match) return [];
    return match[1].trim().split(/\s+/).filter(Boolean).map(Number).filter(Number.isFinite);
  }

  async fetchRaw(uid: number): Promise<string> {
    const output = await this.command('UID', 'FETCH', String(uid), '(RFC822)');
    const literalMatch = output.match(/\{(\d+)\}\r?\n([\s\S]*)\r?\n[A-Z0-9]+ OK/);
    if (literalMatch) return literalMatch[2].slice(0, Number(literalMatch[1]));
    return output;
  }

  async discoverTrashMailbox(): Promise<string | undefined> {
    const output = await this.command('LIST', quote(''), quote('*'));
    const lines = output.split(/\r?\n/).filter((line) => line.startsWith('* LIST'));
    const trashLine = lines.find((line) => /\\Trash/i.test(line));
    if (trashLine) {
      return parseMailboxPath(trashLine);
    }
    return lines
      .map((line) => parseMailboxPath(line))
      .find((path) => path && /^(trash|deleted items|lixeira)$/i.test(path.split(/[/.]/).pop() ?? path));
  }

  async ensureMailbox(mailbox: string): Promise<void> {
    try {
      await this.command('CREATE', quote(mailbox));
    } catch {
      // CREATE fails when the mailbox already exists on many servers.
    }
  }

  async findUidByMessageId(messageId: string): Promise<number | undefined> {
    const output = await this.command(
      'UID',
      'SEARCH',
      'HEADER',
      quote('Message-ID'),
      quote(messageId),
    );
    const match = output.match(/^\* SEARCH[ \t]*([^\r\n]*)/m);
    if (!match) return undefined;
    return match[1].trim().split(/\s+/).map(Number).find(Number.isFinite);
  }

  async move(uid: number, destination: string): Promise<void> {
    try {
      await this.command('UID', 'MOVE', String(uid), quote(destination));
    } catch {
      await this.command('UID', 'COPY', String(uid), quote(destination));
      await this.command('UID', 'STORE', String(uid), '+FLAGS.SILENT', '(\\Deleted)');
    }
  }

  async idleOnce(): Promise<void> {
    const tag = this.nextTag();
    this.write(`${tag} IDLE\r\n`);
    await this.readUntil(/^\+ /m);
    await new Promise((resolve) => {
      setTimeout(resolve, 29_000);
    });
    this.write('DONE\r\n');
    await this.readUntil(new RegExp(`^${tag} OK`, 'm'));
  }

  private async command(command: string, ...args: string[]): Promise<string> {
    const tag = this.nextTag();
    this.write(`${tag} ${[command, ...args].join(' ')}\r\n`);
    const output = await this.readUntil(new RegExp(`^${tag} (OK|NO|BAD)`, 'm'));
    if (new RegExp(`^${tag} (NO|BAD)`, 'm').test(output)) {
      throw new Error(
        `IMAP ${command} failed for ${this.account.slug}: ${summarizeImap(output, tag)}`,
      );
    }
    return output;
  }

  private nextTag(): string {
    this.tag += 1;
    return `A${String(this.tag).padStart(4, '0')}`;
  }

  private write(data: string): void {
    if (!this.socket || this.socket.destroyed) {
      throw new Error(`IMAP socket closed for ${this.account.slug}`);
    }
    this.socket.write(data);
  }

  private readUntil(pattern: RegExp): Promise<string> {
    return new Promise((resolve, reject) => {
      const { socket } = this;
      if (!socket) {
        reject(new Error(`IMAP socket missing for ${this.account.slug}`));
        return;
      }
      const handlers = {
        onData: (chunk: string | Buffer) => {
          this.buffer += chunk.toString();
          if (pattern.test(this.buffer)) {
            const out = this.buffer;
            this.buffer = '';
            socket.off('data', handlers.onData);
            socket.off('error', handlers.onError);
            socket.off('close', handlers.onClose);
            resolve(out);
          }
        },
        onError: (error: Error) => {
          socket.off('data', handlers.onData);
          socket.off('error', handlers.onError);
          socket.off('close', handlers.onClose);
          reject(error);
        },
        onClose: () => {
          socket.off('data', handlers.onData);
          socket.off('error', handlers.onError);
          socket.off('close', handlers.onClose);
          reject(new Error(`IMAP socket closed for ${this.account.slug}`));
        },
      };
      socket.on('data', handlers.onData);
      socket.once('error', handlers.onError);
      socket.once('close', handlers.onClose);
      if (pattern.test(this.buffer)) handlers.onData('');
    });
  }
}

export class TlsImapMailClient implements MailClient {
  private readonly sessions = new Map<string, ImapSession>();

  async connect(): Promise<void> {
    await Promise.all([...this.sessions.values()].map((session) => session.ensureConnected()));
  }

  async close(): Promise<void> {
    await Promise.all([...this.sessions.values()].map((session) => session.close()));
  }

  async listInbox(account: MailAccountConfig): Promise<MailMessage[]> {
    const session = await this.session(account);
    await session.select(account.inbox);
    const uids = await session.searchAll();
    const messages: MailMessage[] = [];
    for (const uid of [...uids].reverse()) {
      const raw = await session.fetchRaw(uid);
      messages.push({ uid, ...parseRawEmail(raw) });
    }
    return messages;
  }

  async moveToReview(account: MailAccountConfig, uid: number): Promise<string> {
    return this.moveToMailbox(account, uid, account.reviewMailbox, {
      sourceMailbox: account.inbox,
    });
  }

  async moveToInbox(
    account: MailAccountConfig,
    uid: number,
    options: MoveOptions = {},
  ): Promise<string> {
    return this.moveToMailbox(account, uid, account.inbox, {
      sourceMailbox: options.sourceMailbox ?? account.reviewMailbox,
      messageId: options.messageId,
    });
  }

  async moveToTrash(
    account: MailAccountConfig,
    uid: number,
    options: MoveOptions = {},
  ): Promise<string> {
    const session = await this.session(account);
    const trash = account.trashMailbox ?? (await session.discoverTrashMailbox());
    if (!trash) throw new Error(`Trash mailbox not found for ${account.slug}`);
    return this.moveToMailbox(account, uid, trash, {
      sourceMailbox: options.sourceMailbox ?? account.reviewMailbox,
      messageId: options.messageId,
    });
  }

  private async moveToMailbox(
    account: MailAccountConfig,
    uid: number,
    destination: string,
    options: MoveOptions,
  ): Promise<string> {
    const session = await this.session(account);
    await session.ensureMailbox(destination);
    await session.select(options.sourceMailbox ?? account.inbox);
    try {
      await session.move(uid, destination);
      return destination;
    } catch (error) {
      if (!options.messageId) throw error;
      const replacementUid = await session.findUidByMessageId(options.messageId);
      if (!replacementUid) throw error;
      await session.move(replacementUid, destination);
      return destination;
    }
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
