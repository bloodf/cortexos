import { describe, it, expect } from 'vitest';
import { parseTranscript } from '../src/transcript-parser.js';
import type { OmcArtifact } from '../src/types.js';

const baseArtifact: OmcArtifact = {
  taskId: 'T-100',
  runId: 'R-1',
  steps: [
    {
      role: 'planner',
      action: 'plan',
      content: 'Draft outline',
      timestamp: '2026-05-18T10:00:00Z',
    },
    {
      role: 'executor',
      action: 'edit',
      content: 'const x = 1;\nconsole.log(x);',
      timestamp: '2026-05-18T10:05:00Z',
    },
  ],
  result: 'All good',
};

describe('parseTranscript', () => {
  it('emits heading, list, and per-step blocks', () => {
    const blocks = parseTranscript(baseArtifact);
    expect(blocks[0]).toEqual({ type: 'heading', content: 'Task T-100 — Run R-1' });
    expect(blocks[1].type).toBe('list');
    if (blocks[1].type === 'list') {
      expect(blocks[1].content).toHaveLength(2);
      expect(blocks[1].content[0]).toContain('planner');
    }
  });

  it('classifies multi-line content as code', () => {
    const blocks = parseTranscript(baseArtifact);
    const codeBlocks = blocks.filter((b) => b.type === 'code');
    expect(codeBlocks.length).toBeGreaterThanOrEqual(1);
    expect((codeBlocks[0] as { content: string }).content).toContain('console.log');
  });

  it('emits a Result heading + paragraph when result is short string', () => {
    const blocks = parseTranscript(baseArtifact);
    const last2 = blocks.slice(-2);
    expect(last2[0]).toEqual({ type: 'heading', content: 'Result' });
    expect(last2[1]).toEqual({ type: 'paragraph', content: 'All good' });
  });

  it('renders object results as JSON code blocks', () => {
    const blocks = parseTranscript({
      ...baseArtifact,
      result: { ok: true, count: 3 },
    });
    const last = blocks[blocks.length - 1];
    expect(last.type).toBe('code');
    expect((last as { content: string }).content).toContain('"ok": true');
  });

  it('omits result blocks when result is null or undefined', () => {
    const blocks = parseTranscript({ ...baseArtifact, result: null });
    expect(blocks.some((b) => b.type === 'heading' && b.content === 'Result')).toBe(false);
  });

  it('handles empty steps with a placeholder paragraph', () => {
    const blocks = parseTranscript({ ...baseArtifact, steps: [] });
    expect(blocks[1]).toEqual({ type: 'paragraph', content: '_No steps recorded._' });
  });

  it('treats JSON-looking single-line strings as code', () => {
    const blocks = parseTranscript({
      ...baseArtifact,
      steps: [{ role: 'r', action: 'a', content: '{"k":"v"}', timestamp: 't' }],
      result: undefined,
    });
    const codeBlock = blocks.find((b) => b.type === 'code');
    expect(codeBlock).toBeTruthy();
  });

  it('rejects non-object artifacts', () => {
    // @ts-expect-error
    expect(() => parseTranscript(null)).toThrow(/object/);
    // @ts-expect-error
    expect(() => parseTranscript('nope')).toThrow(/object/);
  });

  it('rejects missing taskId/runId', () => {
    // @ts-expect-error
    expect(() => parseTranscript({ runId: 'r', steps: [] })).toThrow(/taskId/);
    // @ts-expect-error
    expect(() => parseTranscript({ taskId: 't', steps: [] })).toThrow(/runId/);
  });

  it('rejects non-array steps', () => {
    expect(() =>
      // @ts-expect-error
      parseTranscript({ taskId: 't', runId: 'r', steps: 'x' }),
    ).toThrow(/steps/);
  });

  it('rejects malformed step entries', () => {
    expect(() =>
      parseTranscript({
        taskId: 't',
        runId: 'r',
        // @ts-expect-error
        steps: [{ role: 'r', action: 'a', content: 1, timestamp: 't' }],
      }),
    ).toThrow(/content/);
  });
});
