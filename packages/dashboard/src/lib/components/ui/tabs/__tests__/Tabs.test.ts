/**
 * Tabs.svelte keyboard navigation tests.
 *
 * The Tabs root is a focusable tablist that handles ArrowLeft,
 * ArrowRight, Home, End to move focus between triggers. Each key
 * advances focus AND clicks the next/prev trigger. This file
 * exercises the indexing math (the only branching logic in the
 * component) against the same DOM shape Tabs.svelte produces.
 */
import { describe, it, expect } from 'vitest';

function makeTab(state: 'active' | 'inactive') {
  const el = document.createElement('button');
  el.setAttribute('role', 'tab');
  el.setAttribute('data-state', state);
  return el;
}

/** Mirror of the onkeydown handler in Tabs.svelte. Kept here so
 *  the unit test exercises the same math the Svelte component does,
 *  without needing a full SvelteKit mount. */
function nextIdx(triggers: HTMLElement[], direction: 'forward' | 'backward' | 'home' | 'end'): number {
  const idx = triggers.findIndex((t) => t.getAttribute('data-state') === 'active');
  if (direction === 'forward') return (idx + 1) % triggers.length;
  if (direction === 'backward') return (idx - 1 + triggers.length) % triggers.length;
  if (direction === 'home') return 0;
  return triggers.length - 1;
}

describe('Tabs.svelte keyboard navigation math', () => {
  it('returns the first trigger when no trigger is active (idx === -1)', () => {
    const triggers = [makeTab('inactive')];
    expect(nextIdx(triggers, 'forward')).toBe(0);
  });

  it('ArrowRight advances to the next trigger and wraps at the end', () => {
    const t1 = makeTab('active');
    const t2 = makeTab('inactive');
    const t3 = makeTab('inactive');
    const triggers = [t1, t2, t3];
    expect(nextIdx(triggers, 'forward')).toBe(1);
    // wrap: idx=2 -> (2+1)%3=0
    triggers[2]!.setAttribute('data-state', 'active');
    t1.setAttribute('data-state', 'inactive');
    expect(nextIdx(triggers, 'forward')).toBe(0);
  });

  it('ArrowLeft goes to the previous trigger and wraps at the start', () => {
    const t1 = makeTab('inactive');
    const t2 = makeTab('active');
    const t3 = makeTab('inactive');
    const triggers = [t1, t2, t3];
    // idx=1, backward = (1-1+3)%3 = 0
    expect(nextIdx(triggers, 'backward')).toBe(0);
    // wrap backward: idx=0 -> (0-1+3)%3=2
    t1.setAttribute('data-state', 'active');
    t2.setAttribute('data-state', 'inactive');
    expect(nextIdx(triggers, 'backward')).toBe(2);
  });

  it('Home key always returns the first trigger', () => {
    const triggers = [makeTab('inactive'), makeTab('active'), makeTab('inactive')];
    expect(nextIdx(triggers, 'home')).toBe(0);
  });

  it('End key always returns the last trigger', () => {
    const triggers = [makeTab('active'), makeTab('inactive'), makeTab('inactive')];
    expect(nextIdx(triggers, 'end')).toBe(2);
  });
});
