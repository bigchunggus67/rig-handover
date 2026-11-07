// Plan morning-digest § 1. The contract every part of § 2 builds against; the reader is in read.ts.

export type JobStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's log (runs/<night>.jsonl). "Line" below means a line that parsed.
export type DigestRow = {
  job: string;
  // `owner` of the job's last line. null when the log says null: keep the row, render `—`.
  owner: string | null;
  // Lines for this job, any status.
  runs: number;
  // Lines for this job with status `retry`.
  retries: number;
  // `status` of the job's last line (file order).
  lastStatus: JobStatus;
  // `error` of that same last line; null when the last line has none (even if earlier ones did).
  lastError: string | null;
  // `at` of the job's first and last line (file order), exactly as in the log, offset kept,
  // never converted to UTC. e.g. "2026-10-29T01:30:00+01:00".
  first: string;
  last: string;
};

// Lines per status across the whole night (parsed lines only). The status board shows these.
export type StatusCounts = Record<JobStatus, number>;

// What readNight returns. `found: false` = no file for this night (404). `found: true` with
// `rows: []` = the file exists but nothing ran (empty file, or only bad lines).
export type Night =
  | { night: string; found: false }
  | {
      night: string;
      found: true;
      // Sorted by job (string compare), so the page and the JSON share one order.
      rows: DigestRow[];
      // Non-blank lines that didn't parse as a valid log entry. Counted, never thrown.
      badLines: number;
      counts: StatusCounts;
    };

// `runsDir`: folder holding <YYYY-MM-DD>.jsonl files. `night`: "YYYY-MM-DD"; anything else
// is treated as no file (found: false). Synchronous, like the rest of rig's readers.
export type ReadNight = (runsDir: string, night: string) => Night;
