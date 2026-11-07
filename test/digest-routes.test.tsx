import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const installed = '2026-10-29T14:06:00+01:00';
const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

let runsDir: string;
let app: ReturnType<typeof createApp>;
let previousMarker: string | undefined;

// Hono escapes the apostrophe in text as &#39;; compare on the text a reader would see.
async function page(night: string): Promise<{ status: number; html: string }> {
  const res = await app.request(`/digest/${night}`);
  return { status: res.status, html: (await res.text()).replaceAll('&#39;', "'") };
}

async function json(night: string): Promise<{ status: number; body: Night }> {
  const res = await app.request(`/api/digest/${night}`);
  return { status: res.status, body: (await res.json()) as Night };
}

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-'));
  mkdirSync(runsDir, { recursive: true });

  // Three jobs, out of order in the file: the page and the JSON must sort them by job.
  writeFileSync(
    join(runsDir, '2026-11-01.jsonl'),
    [
      line('2026-11-01T01:00:00+01:00', 'c/job', 'ok', 'rook'),
      line('2026-11-01T02:00:00+01:00', 'a/job', 'retry', 'rook', 'timeout'),
      line('2026-11-01T03:00:00+01:00', 'b/job', 'fail', 'lane-07', 'boom'),
      '',
    ].join('\n'),
  );
  // The empty night: the file exists, nothing in it.
  writeFileSync(join(runsDir, '2026-11-02.jsonl'), '');
  // Good lines plus one cut-off line.
  writeFileSync(
    join(runsDir, '2026-11-03.jsonl'),
    [
      line('2026-11-03T01:00:00+01:00', 'd/job', 'ok', 'rook'),
      line('2026-11-03T02:00:00+01:00', 'e/job', 'ok', 'rook'),
      '{"at":"2026-11-03T03:00:00+01:00","job":"f/',
      '',
    ].join('\n'),
  );
  // No file for 2026-11-04.

  previousMarker = process.env.LANE_MARKER;
  process.env.LANE_MARKER = 'DIGEST-MARKER';
  app = createApp({ adapter: 'shim', installed, beatEverySeconds: 60, runsDir });
});

afterAll(() => {
  if (previousMarker === undefined) delete process.env.LANE_MARKER;
  else process.env.LANE_MARKER = previousMarker;
  rmSync(runsDir, { recursive: true, force: true });
});

describe('digest page', () => {
  it('renders each job of a night on file, under the lane banner', async () => {
    const { status, html } = await page('2026-11-01');
    expect(status).toBe(200);
    for (const job of ['a/job', 'b/job', 'c/job']) expect(html).toContain(job);
    expect(html).toContain('DIGEST-MARKER');
  });

  it('answers 404 for a night with no file', async () => {
    const { status } = await page('2026-11-04');
    expect(status).toBe(404);
  });

  it('says "nothing ran" for an empty night', async () => {
    const { status, html } = await page('2026-11-02');
    expect(status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('shows the good jobs and says the bad line did not parse', async () => {
    const { status, html } = await page('2026-11-03');
    expect(status).toBe(200);
    expect(html).toContain('d/job');
    expect(html).toContain('e/job');
    expect(html).toContain("1 line didn't parse");
  });
});

describe('digest JSON', () => {
  it('returns the night with rows sorted by job, counts and bad lines', async () => {
    const { status, body } = await json('2026-11-01');
    expect(status).toBe(200);
    expect(body.found).toBe(true);
    if (!body.found) return;
    expect(body.night).toBe('2026-11-01');
    expect(body.rows.map((r) => r.job)).toEqual(['a/job', 'b/job', 'c/job']);
    expect(body.rows[0]).toEqual({
      job: 'a/job',
      owner: 'rook',
      runs: 1,
      retries: 1,
      lastStatus: 'retry',
      lastError: 'timeout',
      first: '2026-11-01T02:00:00+01:00',
      last: '2026-11-01T02:00:00+01:00',
    });
    expect(body.badLines).toBe(0);
    expect(body.counts).toEqual({ ok: 1, retry: 1, fail: 1 });
  });

  it('answers 404 with found: false for a night with no file', async () => {
    const { status, body } = await json('2026-11-04');
    expect(status).toBe(404);
    expect(body).toEqual({ night: '2026-11-04', found: false });
  });

  it('returns no rows for an empty night', async () => {
    const { status, body } = await json('2026-11-02');
    expect(status).toBe(200);
    expect(body).toMatchObject({ night: '2026-11-02', found: true, rows: [], badLines: 0 });
  });

  it('counts the bad line and keeps the good jobs', async () => {
    const { status, body } = await json('2026-11-03');
    expect(status).toBe(200);
    expect(body).toMatchObject({ night: '2026-11-03', found: true, badLines: 1 });
    if (!body.found) return;
    expect(body.rows.map((r) => r.job)).toEqual(['d/job', 'e/job']);
  });
});

describe('digest page and JSON agree', () => {
  it.each(['2026-11-01', '2026-11-03'])('lists %s in the page in the same order as the JSON rows', async (night) => {
    const { body } = await json(night);
    const { html } = await page(night);
    expect(body.found).toBe(true);
    if (!body.found) return;
    const positions = body.rows.map((r) => html.indexOf(r.job));
    for (const pos of positions) expect(pos).toBeGreaterThan(-1);
    expect(positions).toEqual([...positions].sort((x, y) => x - y));
  });
});
