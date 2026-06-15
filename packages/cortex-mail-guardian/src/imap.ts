import tls from 'node:tls';
import { once } from 'node:events';
import type { MailAccountConfig } from './config.js';
import lookupWithFallback from './dns.js';
import runSequentially from './sequential.js';

export const COMMAND_SOCKET_TIMEOUT_MS = 30_000;
export const IDLE_SOCKET_TIMEOUT_MS = 120_000;

// Server-side connection recycles (e.g. shared IMAP hosts that drop idle
// connections hourly) are expected and benign — distinguish them from real
// errors so callers can log at the appropriate level.
export class ImapConnectionClosedError extends Error {
  constructor(slug: string) {
    super(`IMAP connection closed for ${slug}`);
    this.name = 'ImapConnectionClosedError';
  }
}

export interface MailMessage {
  uid: number;
  messageId?: string;
  from: string;
  subject: string;
  /** Normalized text used for classification (HTML stripped, whitespace collapsed). */
  text: string;
  /**
   * Human-readable body for display: the decoded text/plain part of a multipart
   * message (or the decoded single part), with transfer-encoding (base64 /
   * quoted-printable) resolved. Falls back to `text` when extraction can't find
   * a better candidate.
   */
  bodyText?: string;
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

/**
 * Extract the personal-namespace prefix from an IMAP NAMESPACE response.
 *
 * Some Dovecot servers (e.g. mail.heitorramon.com) expose a personal namespace
 * rooted under `INBOX.` — SELECT/MOVE on a bare `Trash` or `Cortex Mail
 * Guardian Review` is rejected with "nonexistent namespace ... prefix with
 * INBOX.". The response looks like: `* NAMESPACE (("INBOX." ".")) NIL NIL`.
 * Returns the first personal prefix (here `INBOX.`) or undefined when the
 * personal namespace has an empty prefix (the common case, e.g. the geeks
 * servers, where no normalization is needed).
 */
export function parseNamespacePrefix(output: string): string | undefined {
  const match = output.match(/\* NAMESPACE\s+\(\((.*?)\)\)/);
  if (!match) return undefined;
  // First personal namespace entry: ("<prefix>" "<delim>").
  const entry = match[1].match(/"((?:\\"|[^"])*)"/);
  const prefix = entry?.[1]?.replace(/\\"/g, '"');
  return prefix && prefix.length > 0 ? prefix : undefined;
}

/**
 * Defensively prefix a mailbox name with the server's personal-namespace prefix
 * when required. Leaves `INBOX` (and anything already under the prefix) alone;
 * applies the prefix to bare names like `Trash` → `INBOX.Trash`. A no-op when
 * the server has no personal prefix. This makes mailbox addressing robust to
 * stored values (DB/env) or discovered names that omit the prefix.
 */
export function applyNamespacePrefix(mailbox: string, prefix: string | undefined): string {
  if (!prefix) return mailbox;
  if (mailbox === 'INBOX' || mailbox === prefix.replace(/\.$/, '')) return mailbox;
  if (mailbox.startsWith(prefix)) return mailbox;
  return `${prefix}${mailbox}`;
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

function decodeQuotedPrintable(input: string): string {
  const stripped = input.replace(/=\r?\n/g, '');
  // Collect raw bytes (literal chars as their code, `=XX` as the hex byte) then
  // decode the whole buffer as UTF-8 — char-by-char decoding mangles multi-byte
  // sequences (e.g. `=C3=A9` must become `é`, not two Latin-1 chars).
  const bytes: number[] = [];
  for (let i = 0; i < stripped.length; i += 1) {
    const ch = stripped[i];
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(stripped.slice(i + 1, i + 3))) {
      bytes.push(parseInt(stripped.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(ch.charCodeAt(0));
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

function decodeTransfer(body: string, encoding: string | undefined): string {
  const enc = (encoding ?? '').toLowerCase();
  if (enc.includes('base64')) {
    try {
      return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
    } catch {
      return body;
    }
  }
  if (enc.includes('quoted-printable')) return decodeQuotedPrintable(body);
  return body;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function normalizeBody(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract a human-readable body. For multipart messages, prefer the text/plain
 * part, falling back to a tag-stripped text/html part; resolve base64 /
 * quoted-printable transfer encoding. Returns "" when nothing usable is found.
 */
function extractBodyText(headers: Map<string, string>, body: string): string {
  const contentType = headers.get('content-type') ?? '';
  const boundary = contentType.match(/boundary="?([^";]+)"?/i)?.[1];

  if (/multipart/i.test(contentType) && boundary) {
    const parts = body
      .split(`--${boundary}`)
      .map((seg) => seg.trim())
      .filter((seg) => seg && seg !== '--')
      .map((seg) => {
        const [ph, ...pb] = seg.split(/\r?\n\r?\n/);
        return { headers: parseHeaders(ph), raw: pb.join('\n\n') };
      });
    const plain = parts.find((p) => /text\/plain/i.test(p.headers.get('content-type') ?? ''));
    if (plain) {
      return normalizeBody(
        decodeTransfer(plain.raw, plain.headers.get('content-transfer-encoding')),
      );
    }
    const html = parts.find((p) => /text\/html/i.test(p.headers.get('content-type') ?? ''));
    if (html) {
      return normalizeBody(
        htmlToText(decodeTransfer(html.raw, html.headers.get('content-transfer-encoding'))),
      );
    }
    return '';
  }

  const decoded = decodeTransfer(body, headers.get('content-transfer-encoding'));
  return normalizeBody(/text\/html/i.test(contentType) ? htmlToText(decoded) : decoded);
}

export function parseRawEmail(raw: string): Omit<MailMessage, 'uid'> {
  const [headerRaw, ...bodyParts] = raw.split(/\r?\n\r?\n/);
  const headers = parseHeaders(headerRaw);
  const body = bodyParts.join('\n\n');
  const bodyText = extractBodyText(headers, body);
  return {
    messageId: headers.get('message-id'),
    from: decodeHeader(headers.get('from') ?? ''),
    subject: decodeHeader(headers.get('subject') ?? ''),
    text: body
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
    bodyText: bodyText || undefined,
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
  /** Server personal-namespace prefix (e.g. `INBOX.`); undefined when none. */
  private namespacePrefix?: string;

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
    socket.setTimeout(COMMAND_SOCKET_TIMEOUT_MS);
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
    // Capture the personal-namespace prefix so mailbox names are addressed
    // correctly on servers that require one (e.g. INBOX.-rooted Dovecot).
    // Best-effort: servers without NAMESPACE leave the prefix undefined.
    try {
      this.namespacePrefix = parseNamespacePrefix(await this.command('NAMESPACE'));
    } catch {
      this.namespacePrefix = undefined;
    }
    socket.on('error', () => {
      // Later command/read paths handle closed sockets; avoid process-level unhandled errors.
    });
  }

  /** Normalize a mailbox name against the server's personal namespace. */
  private qualify(mailbox: string): string {
    return applyNamespacePrefix(mailbox, this.namespacePrefix);
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
    await this.command('SELECT', quote(this.qualify(mailbox)));
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
      .find(
        (path) => path && /^(trash|deleted items|lixeira)$/i.test(path.split(/[/.]/).pop() ?? path),
      );
  }

  async ensureMailbox(mailbox: string): Promise<void> {
    try {
      await this.command('CREATE', quote(this.qualify(mailbox)));
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
    const target = this.qualify(destination);
    try {
      await this.command('UID', 'MOVE', String(uid), quote(target));
    } catch {
      await this.command('UID', 'COPY', String(uid), quote(target));
      await this.command('UID', 'STORE', String(uid), '+FLAGS.SILENT', '(\\Deleted)');
    }
  }

  async idleOnce(): Promise<void> {
    const tag = this.nextTag();
    this.write(`${tag} IDLE\r\n`);
    await this.readUntil(/^\+ /m);
    if (!this.socket) {
      throw new Error(`IMAP socket missing for ${this.account.slug}`);
    }
    this.socket.setTimeout(IDLE_SOCKET_TIMEOUT_MS);
    await new Promise((resolve) => {
      setTimeout(resolve, 29_000);
    });
    this.write('DONE\r\n');
    await this.readUntil(new RegExp(`^${tag} OK`, 'm'));
    this.socket.setTimeout(COMMAND_SOCKET_TIMEOUT_MS);
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
      throw new ImapConnectionClosedError(this.account.slug);
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
          reject(new ImapConnectionClosedError(this.account.slug));
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
    return runSequentially([...uids].reverse(), async (uid) => {
      const raw = await session.fetchRaw(uid);
      return { uid, ...parseRawEmail(raw) };
    });
  }

  /**
   * Read-only fetch of a single message by UID from an explicit mailbox,
   * re-parsed through the same path as `listInbox` (so the result carries the
   * decoded `bodyText`/`subject`). Returns `undefined` when the UID is no
   * longer present in the mailbox. Used by the one-off decode backfill; it
   * SELECTs and FETCHes only — it never moves, copies, or deletes mail.
   */
  async fetchRawByUid(
    account: MailAccountConfig,
    mailbox: string,
    uid: number,
  ): Promise<MailMessage | undefined> {
    const session = await this.session(account);
    await session.select(mailbox);
    const raw = await session.fetchRaw(uid);
    const parsed = parseRawEmail(raw);
    // A FETCH for an absent UID returns the tagged OK with no message literal;
    // fetchRaw then yields the bare protocol echo, which parses to an empty
    // message. Treat "no from, subject, or body" as "UID gone".
    if (!parsed.from && !parsed.subject && !parsed.text) return undefined;
    return { uid, ...parsed };
  }

  /**
   * Read-only fetch of a single message located by its `Message-ID` header
   * within an explicit mailbox. Needed because IMAP MOVE/COPY reassigns
   * destination-mailbox UIDs — a review row's stored `message_uid` (the original
   * INBOX UID) does not address the same message once it sits in the review
   * mailbox, but the immutable Message-ID still does. Returns `undefined` when
   * no message matches. SELECT + SEARCH + FETCH only; never mutates mail.
   */
  async fetchByMessageId(
    account: MailAccountConfig,
    mailbox: string,
    messageId: string,
  ): Promise<MailMessage | undefined> {
    const session = await this.session(account);
    await session.select(mailbox);
    const uid = await session.findUidByMessageId(messageId);
    // No (valid) match: an empty IMAP SEARCH yields no usable UID, so don't
    // issue a `UID FETCH` for a missing/zero UID (servers reject it as an
    // "invalid uidset"). Treat as "message not in this mailbox".
    if (uid === undefined || !Number.isInteger(uid) || uid <= 0) return undefined;
    const raw = await session.fetchRaw(uid);
    const parsed = parseRawEmail(raw);
    if (!parsed.from && !parsed.subject && !parsed.text) return undefined;
    return { uid, ...parsed };
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
