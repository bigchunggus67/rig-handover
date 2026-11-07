import { describe, expect, it } from 'vitest';
import type { DigestRow } from '../src/digest/types.js';
import { lane } from '../src/lane.js';
import { DigestPage } from '../src/views/digest.js';
import { Layout } from '../src/views/layout.js';

const row = (o: Partial<DigestRow>): DigestRow => ({
  job: 'a', owner: 'ann', runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
  first: '2026-10-29T01:30:00+01:00', last: '2026-10-29T01:31:00+01:00', ...o,
});

const render = (rows: DigestRow[], badLines = 0) =>
  String(
    <Layout title="digest · 2026-10-28" lane={lane()}>
      <DigestPage night="2026-10-28" rows={rows} badLines={badLines} />
    </Layout>,
  );

describe('digest view', () => {
  it('keeps row order, offsets, and uses — for missing data', () => {
    const html = render([row({ job: 'zeta', owner: null }), row({ job: 'alpha' })]);
    expect(html.indexOf('zeta')).toBeLessThan(html.indexOf('alpha'));
    expect(html).toContain('<td>—</td>');
    expect(html).toContain('2026-10-29T01:30:00+01:00');
    expect(html).not.toContain('<td></td>');
  });

  it('marks retries >= 3 and failed rows', () => {
    const html = render([row({ job: 'r2', retries: 2 }), row({ job: 'r3', retries: 3 }), row({ job: 'f', lastStatus: 'fail', lastError: 'boom' })]);
    expect(html).toContain('<td class="warn">3</td>');
    expect(html).not.toContain('<td class="warn">2</td>');
    expect(html).toContain('<td class="warn">fail</td>');
    expect(html).toContain('<td class="warn">boom</td>');
  });

  it('says nothing ran for an empty night', () => {
    const html = render([]);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table');
  });

  it('notes lines that did not parse', () => {
    expect(render([row({})], 1)).toContain('1 line didn&#39;t parse');
    expect(render([row({})], 2)).toContain('2 lines didn&#39;t parse');
    expect(render([row({})], 0)).not.toContain('t parse');
  });
});
