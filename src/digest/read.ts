import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, ReadNight, StatusCounts } from './types.js';

// Plan morning-digest § 1: read runs/<night>.jsonl into one row per job.

type Entry = { at: string; job: string; status: JobStatus; owner: string | null; error?: string };

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

function isStatus(v: unknown): v is JobStatus {
  return v === 'ok' || v === 'retry' || v === 'fail';
}

// Parse one line at the edge; null = bad line.
function parseLine(line: string): Entry | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const { at, job, status, owner, error } = o;
  if (typeof at !== 'string' || typeof job !== 'string' || !isStatus(status)) return null;
  if (!(typeof owner === 'string' || owner === null)) return null;
  if ('error' in o && typeof error !== 'string') return null;
  return typeof error === 'string' ? { at, job, status, owner, error } : { at, job, status, owner };
}

function readFile(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'ENOENT') return null;
    throw e;
  }
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return { night, found: false };
  const text = readFile(join(runsDir, `${night}.jsonl`));
  if (text === null) return { night, found: false };

  const rows = new Map<string, DigestRow>();
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;

  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const e = parseLine(line);
    if (e === null) {
      badLines++;
      continue;
    }
    counts[e.status]++;
    const row = rows.get(e.job);
    if (row === undefined) {
      rows.set(e.job, {
        job: e.job,
        owner: e.owner,
        runs: 1,
        retries: e.status === 'retry' ? 1 : 0,
        lastStatus: e.status,
        lastError: e.error ?? null,
        first: e.at,
        last: e.at,
      });
    } else {
      row.owner = e.owner;
      row.runs++;
      if (e.status === 'retry') row.retries++;
      row.lastStatus = e.status;
      row.lastError = e.error ?? null;
      row.last = e.at;
    }
  }

  const sorted = [...rows.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, found: true, rows: sorted, badLines, counts };
};
