import { describe, it, expect, vi } from 'vitest';
import { ExternalAdapter } from '../src/external-adapter.js';

function mockOk(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

function mockBadJson() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => {
      throw new Error('bad json');
    },
  });
}

describe('ExternalAdapter constructor', () => {
  it('requires baseUrl', () => {
    // @ts-expect-error
    expect(() => new ExternalAdapter({ token: 'x' })).toThrow(/baseUrl/);
  });
  it('requires token', () => {
    // @ts-expect-error
    expect(() => new ExternalAdapter({ baseUrl: 'http://x' })).toThrow(/token/);
  });
  it('trims trailing slash from baseUrl', async () => {
    const fetchImpl = mockOk({ items: [] });
    const a = new ExternalAdapter({ baseUrl: 'http://x/', token: 't', fetchImpl });
    await a.poll();
    expect(fetchImpl.mock.calls[0][0]).toBe('http://x/api/agents/me/inbox-lite');
  });
});

describe('ExternalAdapter.poll', () => {
  it('returns inbox items on success', async () => {
    const fetchImpl = mockOk({ items: [{ id: 'i1' }] });
    const a = new ExternalAdapter({ baseUrl: 'http://x', token: 't', fetchImpl });
    const res = await a.poll();
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ items: [{ id: 'i1' }] });
  });

  it('sends Bearer auth header', async () => {
    const fetchImpl = mockOk({ items: [] });
    const a = new ExternalAdapter({ baseUrl: 'http://x', token: 'tk', fetchImpl });
    await a.poll();
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer tk');
  });

  it('captures fetch errors as failed result', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom'));
    const a = new ExternalAdapter({ baseUrl: 'http://x', token: 't', fetchImpl });
    const res = await a.poll();
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/boom/);
    expect(res.data).toBeNull();
  });

  it('tolerates non-JSON response bodies', async () => {
    const a = new ExternalAdapter({ baseUrl: 'http://x', token: 't', fetchImpl: mockBadJson() });
    const res = await a.poll();
    expect(res.ok).toBe(true);
    expect(res.data).toBeNull();
  });
});

describe('ExternalAdapter.checkout', () => {
  it('claims an issue and returns claimed=true on 2xx', async () => {
    const fetchImpl = mockOk({});
    const a = new ExternalAdapter({ baseUrl: 'http://x', token: 't', fetchImpl });
    const res = await a.checkout('issue-1', 'run-1');
    expect(res.ok).toBe(true);
    expect(res.data).toEqual({ issueId: 'issue-1', runId: 'run-1', claimed: true });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://x/api/issues/issue-1/checkout');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Paperclip-Run-Id']).toBe('run-1');
    expect(init.body).toBe('{}');
  });

  it('reports claimed=false on non-2xx', async () => {
    const fetchImpl = mockOk({ error: 'conflict' }, 409);
    const a = new ExternalAdapter({ baseUrl: 'http://x', token: 't', fetchImpl });
    const res = await a.checkout('i', 'r');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(409);
    expect(res.data).toEqual({ issueId: 'i', runId: 'r', claimed: false });
  });

  it('rejects missing args', async () => {
    const a = new ExternalAdapter({ baseUrl: 'http://x', token: 't', fetchImpl: mockOk({}) });
    await expect(a.checkout('', 'r')).rejects.toThrow(/issueId/);
    await expect(a.checkout('i', '')).rejects.toThrow(/runId/);
  });

  it('url-encodes issueId', async () => {
    const fetchImpl = mockOk({});
    const a = new ExternalAdapter({ baseUrl: 'http://x', token: 't', fetchImpl });
    await a.checkout('a/b', 'r');
    expect(fetchImpl.mock.calls[0][0]).toBe('http://x/api/issues/a%2Fb/checkout');
  });
});

describe('ExternalAdapter.complete', () => {
  it('PATCHes the issue and returns status', async () => {
    const fetchImpl = mockOk({ status: 'done' });
    const a = new ExternalAdapter({ baseUrl: 'http://x', token: 't', fetchImpl });
    const res = await a.complete('i1', 'r1', { result: 'ok' });
    expect(res.ok).toBe(true);
    expect(res.data).toEqual({ issueId: 'i1', status: 'done' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://x/api/issues/i1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ result: 'ok' });
  });

  it('defaults status to completed when server omits it', async () => {
    const a = new ExternalAdapter({ baseUrl: 'http://x', token: 't', fetchImpl: mockOk({}) });
    const res = await a.complete('i', 'r', {});
    expect(res.data).toEqual({ issueId: 'i', status: 'completed' });
  });

  it('returns data=null on non-2xx', async () => {
    const a = new ExternalAdapter({
      baseUrl: 'http://x',
      token: 't',
      fetchImpl: mockOk({ error: 'x' }, 500),
    });
    const res = await a.complete('i', 'r', {});
    expect(res.ok).toBe(false);
    expect(res.data).toBeNull();
  });

  it('rejects missing args', async () => {
    const a = new ExternalAdapter({ baseUrl: 'http://x', token: 't', fetchImpl: mockOk({}) });
    await expect(a.complete('', 'r', {})).rejects.toThrow(/issueId/);
    await expect(a.complete('i', '', {})).rejects.toThrow(/runId/);
  });
});
