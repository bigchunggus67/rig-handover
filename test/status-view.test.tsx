import { describe, expect, it } from 'vitest';
import { StatusBoard } from '../src/views/status.js';
import type { Status } from '../src/status.js';

const status: Status = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  lastBeat: null,
  nights: ['2026-10-28', '2026-10-27', '2026-10-26'],
  counts: {
    '2026-10-28': { ok: 10, retry: 4, fail: 1 },
    '2026-10-27': { ok: 7, retry: 0, fail: 0 },
    '2026-10-26': null,
  },
};

describe('status board view', () => {
  it('links each night to its digest with counts, newest first, — when missing', () => {
    const html = String(<StatusBoard status={status} />);
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a> · 10 ok · 4 retry · 1 fail');
    expect(html).toContain('<a href="/digest/2026-10-27">2026-10-27</a> · 7 ok · 0 retry · 0 fail');
    expect(html).toContain('<a href="/digest/2026-10-26">2026-10-26</a> · —');
    expect(html.indexOf('2026-10-28')).toBeLessThan(html.indexOf('2026-10-27'));
  });
});
