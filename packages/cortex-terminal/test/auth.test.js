import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkOrigin, clientIp, dbConfig, parseCookies } from '../src/server.js';

describe('parseCookies', () => {
  it('returns an empty map for a missing or empty header', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
  });

  it('parses a single cookie', () => {
    expect(parseCookies('cortexos_session=abc123')).toEqual({ cortexos_session: 'abc123' });
  });

  it('parses multiple semicolon-separated cookies and trims whitespace', () => {
    expect(parseCookies('a=1; b=2;  c=3')).toEqual({ a: '1', b: '2', c: '3' });
  });

  it('keeps "=" characters that appear inside a value', () => {
    expect(parseCookies('token=a=b=c')).toEqual({ token: 'a=b=c' });
  });

  it('URL-decodes values', () => {
    expect(parseCookies('redirect=%2Fadmin%2Fusers')).toEqual({ redirect: '/admin/users' });
  });

  it('skips malformed segments without a key or "="', () => {
    expect(parseCookies('garbage; =novalue; ok=1')).toEqual({ ok: '1' });
  });

  it('never throws on undecodable percent-escapes', () => {
    // A lone '%' is invalid for decodeURIComponent; parseCookies must surface
    // it without throwing rather than crash the upgrade handler.
    expect(() => parseCookies('x=%')).not.toThrow();
  });
});

describe('checkOrigin (WS CSRF defense)', () => {
  describe('fixed-origin mode (ALLOWED_ORIGIN is a concrete origin)', () => {
    const allowed = 'https://cortexos.example.ts.net';

    it('accepts an exact match', () => {
      expect(checkOrigin(allowed, 'cortexos.example.ts.net', allowed)).toBe(true);
    });

    it('rejects a different origin', () => {
      expect(checkOrigin('https://evil.example.com', 'cortexos.example.ts.net', allowed)).toBe(
        false,
      );
    });

    it('rejects a missing origin', () => {
      expect(checkOrigin(undefined, 'cortexos.example.ts.net', allowed)).toBe(false);
    });
  });

  describe('same-origin mode (ALLOWED_ORIGIN unset or "same-origin")', () => {
    [undefined, '', 'same-origin'].forEach((allowed) => {
      it(`accepts when the Origin host equals the Host (allowed=${JSON.stringify(allowed)})`, () => {
        expect(checkOrigin('https://cortex.host:3080', 'cortex.host:3080', allowed)).toBe(true);
      });

      it(`rejects when the Origin host differs from the Host (allowed=${JSON.stringify(allowed)})`, () => {
        expect(checkOrigin('https://evil.com', 'cortex.host:3080', allowed)).toBe(false);
      });

      it(`rejects a missing Origin (allowed=${JSON.stringify(allowed)})`, () => {
        expect(checkOrigin(undefined, 'cortex.host:3080', allowed)).toBe(false);
      });

      it(`rejects an unparseable Origin (allowed=${JSON.stringify(allowed)})`, () => {
        expect(checkOrigin('not a url', 'cortex.host:3080', allowed)).toBe(false);
      });
    });
  });
});

describe('clientIp', () => {
  it('uses the first entry of X-Forwarded-For, trimmed', () => {
    const req = { headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }, socket: {} };
    expect(clientIp(req)).toBe('203.0.113.7');
  });

  it('falls back to the socket remote address when no XFF is present', () => {
    const req = { headers: {}, socket: { remoteAddress: '127.0.0.1' } };
    expect(clientIp(req)).toBe('127.0.0.1');
  });

  it('returns "unknown" when neither is available', () => {
    const req = { headers: {}, socket: {} };
    expect(clientIp(req)).toBe('unknown');
  });
});

describe('dbConfig', () => {
  const DB_KEYS = ['DB_PASSWORD', 'DATABASE_URL', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER'];
  /** @type {Record<string, string | undefined>} */
  let saved = {};

  beforeEach(() => {
    saved = {};
    DB_KEYS.forEach((k) => {
      saved[k] = process.env[k];
      delete process.env[k];
    });
  });

  afterEach(() => {
    DB_KEYS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
  });

  it('throws when neither DB_PASSWORD nor DATABASE_URL is set', () => {
    expect(() => dbConfig()).toThrow(/DB_PASSWORD/);
  });

  it('prefers DATABASE_URL when present', () => {
    process.env.DATABASE_URL = 'postgres://u:p@db:5432/x';
    expect(dbConfig()).toEqual({ connectionString: 'postgres://u:p@db:5432/x' });
  });

  it('builds a discrete config from DB_* with sane defaults', () => {
    process.env.DB_PASSWORD = 'secret';
    expect(dbConfig()).toEqual({
      host: '127.0.0.1',
      port: 5432,
      database: 'cortex_dashboard',
      user: 'dashboard',
      password: 'secret',
    });
  });

  it('honors overrides for host, port, name, and user', () => {
    process.env.DB_PASSWORD = 'secret';
    process.env.DB_HOST = 'db.internal';
    process.env.DB_PORT = '6543';
    process.env.DB_NAME = 'other_db';
    process.env.DB_USER = 'svc';
    expect(dbConfig()).toEqual({
      host: 'db.internal',
      port: 6543,
      database: 'other_db',
      user: 'svc',
      password: 'secret',
    });
  });
});
