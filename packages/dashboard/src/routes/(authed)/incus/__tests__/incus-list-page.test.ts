/**
 * incus-list-page.test.ts — exercises the /incus page server
 * `load()` (returns the instance list + filters + counts + admin
 * flag). Verifies:
 *   - default load returns the seeded instances
 *   - `?q=`, `?status=`, `?type=` filters
 *   - invalid filter values fall back to `all`
 *   - isAdmin flag is correctly false when no session
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { load as listLoad } from '../../../../routes/(authed)/incus/+page.server';
import { _resetIncusBridgeForTests } from '$lib/server/incus/bridge';

beforeEach(() => {
  _resetIncusBridgeForTests();
});

function makeLoadEvent(query: Record<string, string> = {}) {
  const url = new URL('http://localhost/incus');
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, v);
  }
  return {
    url,
    cookies: { get: () => undefined },
    request: new Request('http://localhost/incus'),
    params: {},
    route: { id: null },
    locals: {},
    getClientAddress: () => '127.0.0.1',
  } as unknown as Parameters<typeof listLoad>[0];
}

type ListPageData = {
  instances: Array<{ name: string; status: string; type: string; [k: string]: unknown }>;
  total: number;
  q: string;
  status: string;
  type: string;
  isAdmin: boolean;
  messages: unknown;
};

async function loadList(event: ReturnType<typeof makeLoadEvent>): Promise<ListPageData> {
  return (await listLoad(event)) as unknown as ListPageData;
}

describe('/incus list page — load()', () => {
  it('returns the seeded instances', async () => {
    const data = await loadList(makeLoadEvent());
    expect(data.instances.length).toBeGreaterThanOrEqual(3);
    expect(data.total).toBe(data.instances.length);
    expect(data.isAdmin).toBe(false);
    expect(data.status).toBe('all');
    expect(data.type).toBe('all');
    expect(data.q).toBe('');
  });

  it('filters by ?q=name substring', async () => {
    const data = await loadList(makeLoadEvent({ q: 'paperclip' }));
    expect(data.instances.length).toBe(1);
    expect(data.instances[0]?.name).toBe('paperclip-relay');
  });

  it('filters by ?status=active', async () => {
    const data = await loadList(makeLoadEvent({ status: 'active' }));
    expect(data.instances.every((i) => i.status === 'active')).toBe(true);
  });

  it('filters by ?type=vm', async () => {
    const data = await loadList(makeLoadEvent({ type: 'vm' }));
    expect(data.instances.every((i) => i.type === 'vm')).toBe(true);
  });

  it('falls back to `all` for an invalid status', async () => {
    const data = await loadList(makeLoadEvent({ status: 'invalid' }));
    expect(data.status).toBe('all');
    expect(data.instances.length).toBeGreaterThan(0);
  });

  it('falls back to `all` for an invalid type', async () => {
    const data = await loadList(makeLoadEvent({ type: 'container-vm' }));
    expect(data.type).toBe('all');
  });
});
