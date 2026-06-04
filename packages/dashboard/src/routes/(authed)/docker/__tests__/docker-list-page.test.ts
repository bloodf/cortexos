/**
 * docker-list-page.test.ts — exercises the /docker list page
 * server `load()`: returns the adapted containers, honors the
 * URL bootstrap (`?q=` and `?state=`), and collapses the UI's
 * `stopped` state into the stub's `exited | created | dead`
 * filter.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDockerStub } from '$lib/server/docker/stub-data';
import { load as dockerListLoad } from '../../../../routes/(authed)/docker/+page.server';

beforeEach(() => {
  _resetDockerStub();
});

function makeLoadEvent(url: string, params: Record<string, string> = {}) {
  const u = new URL(url, 'http://localhost/');
  return { url: u, params } as unknown as Parameters<typeof dockerListLoad>[0];
}

/** Shape of the page-server's return value (from +page.server.ts). */
type ListPageData = {
  containers: Array<{ id: string; name: string; state: string; [k: string]: unknown }>;
  initialQuery: string;
  initialState: 'all' | 'stopped' | 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created' | 'removing';
};

async function loadList(event: ReturnType<typeof makeLoadEvent>): Promise<ListPageData> {
  return (await dockerListLoad(event)) as unknown as ListPageData;
}

describe('/docker list page — load()', () => {
  it('returns the seed containers when the URL has no params', async () => {
    const data = await loadList(makeLoadEvent('http://localhost/docker'));
    expect(data.containers.length).toBeGreaterThan(0);
    expect(data.initialQuery).toBe('');
    expect(data.initialState).toBe('all');
  });

  it('honors ?q= for the free-text query', async () => {
    const data = await loadList(makeLoadEvent('http://localhost/docker?q=grafana'));
    expect(data.initialQuery).toBe('grafana');
    // The filtered list is at most 1 row (only `grafana-1` matches).
    expect(data.containers.every((c) => c.name.toLowerCase().includes('grafana'))).toBe(true);
  });

  it('honors ?state=running for the state filter', async () => {
    const data = await loadList(makeLoadEvent('http://localhost/docker?state=running'));
    expect(data.initialState).toBe('running');
    expect(data.containers.every((c) => c.state === 'running')).toBe(true);
  });

  it('coerces an unknown ?state= value to "all"', async () => {
    const data = await loadList(makeLoadEvent('http://localhost/docker?state=banana'));
    expect(data.initialState).toBe('all');
  });

  it('maps ?state=stopped to the exited/created/dead union', async () => {
    // The page server's `initialState` echoes the URL value through
    // (it does NOT pre-collapse to a stub filter — the page UI
    // applies the union client-side). The seed contains a few
    // stopped containers.
    const data = await loadList(makeLoadEvent('http://localhost/docker?state=stopped'));
    expect(data.initialState).toBe('stopped');
    // All returned containers should match either 'exited' or
    // 'created' (the union the page applies).
    expect(
      data.containers.every((c) => c.state === 'exited' || c.state === 'created' || c.state === 'dead'),
    ).toBe(true);
  });
});
