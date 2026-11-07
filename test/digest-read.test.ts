import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const tmp = mkdtempSync(join(tmpdir(), 'rig-digest-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl: 5 jobs, 1 bad line', () => {
    const n = readNight('runs', '2026-10-28');
    if (!n.found) throw new Error('expected found');
    expect(n.badLines).toBe(1);
    expect(n.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(n.rows).toEqual([
      { job: 'digest/render', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
        first: '2026-10-29T05:41:09+01:00', last: '2026-10-29T05:41:09+01:00' },
      { job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, lastStatus: 'ok', lastError: null,
        first: '2026-10-29T01:30:00+01:00', last: '2026-10-29T01:37:00+01:00' },
      { job: 'lane/sync', owner: 'rook', runs: 8, retries: 1, lastStatus: 'ok', lastError: null,
        first: '2026-10-28T23:00:06+01:00', last: '2026-10-29T05:00:04+01:00' },
      { job: 'notes/backup', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded',
        first: '2026-10-29T04:00:01+01:00', last: '2026-10-29T04:00:01+01:00' },
      { job: 'rig/rotate-logs', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
        first: '2026-10-28T23:00:02+01:00', last: '2026-10-28T23:00:02+01:00' },
    ]);
  });

  it('reads runs/2026-10-27.jsonl: 4 jobs, no bad lines', () => {
    const n = readNight('runs', '2026-10-27');
    if (!n.found) throw new Error('expected found');
    expect(n.badLines).toBe(0);
    expect(n.counts).toEqual({ ok: 7, retry: 0, fail: 0 });
    expect(n.rows.map((r) => [r.job, r.runs])).toEqual([
      ['fixtures/refresh', 1],
      ['lane/sync', 4],
      ['notes/backup', 1],
      ['rig/rotate-logs', 1],
    ]);
  });

  it('a night with no file is not found', () => {
    expect(readNight('runs', '2026-10-01')).toEqual({ night: '2026-10-01', found: false });
  });

  it('a night name that is not YYYY-MM-DD is not found', () => {
    for (const night of ['../runs/2026-10-28', '2026-10-28.jsonl', 'latest', '']) {
      expect(readNight('runs', night)).toEqual({ night, found: false });
    }
  });

  it('an empty file is found with no rows', () => {
    writeFileSync(join(tmp, '2026-01-01.jsonl'), '');
    expect(readNight(tmp, '2026-01-01')).toEqual({
      night: '2026-01-01', found: true, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('blank lines are not bad lines', () => {
    writeFileSync(join(tmp, '2026-01-02.jsonl'), '\n  \n\r\n\n');
    const n = readNight(tmp, '2026-01-02');
    expect(n).toMatchObject({ found: true, rows: [], badLines: 0 });
  });

  it('only bad lines: found, no rows, each counted', () => {
    writeFileSync(
      join(tmp, '2026-01-03.jsonl'),
      [
        'not json',
        '[1,2]',
        '"text"',
        '{"at":"t","job":"a","status":"done","owner":"x"}',
        '{"at":"t","job":"a","status":"ok"}',
        '{"at":"t","job":"a","status":"ok","owner":5}',
        '{"at":"t","job":"a","status":"ok","owner":"x","error":null}',
        '{"at":1,"job":"a","status":"ok","owner":"x"}',
        '{"at":"t","status":"ok","owner":"x"}',
      ].join('\n'),
    );
    expect(readNight(tmp, '2026-01-03')).toMatchObject({ found: true, rows: [], badLines: 9 });
  });

  it('owner and error come from the last line', () => {
    writeFileSync(
      join(tmp, '2026-01-04.jsonl'),
      '{"at":"a","job":"j","status":"retry","owner":"x","error":"boom"}\n' +
        '{"at":"b","job":"j","status":"ok","owner":null}\n',
    );
    const n = readNight(tmp, '2026-01-04');
    if (!n.found) throw new Error('expected found');
    expect(n.rows).toEqual([
      { job: 'j', owner: null, runs: 2, retries: 1, lastStatus: 'ok', lastError: null, first: 'a', last: 'b' },
    ]);
  });
});
