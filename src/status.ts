import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';
import { readNight } from './digest/read.js';
import type { StatusCounts } from './digest/types.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: string[];
  // Per night; null = missing (night not found, or the reader failed).
  counts: Record<string, StatusCounts | null>;
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

function countsFor(runsDir: string, night: string): StatusCounts | null {
  try {
    const n = readNight(runsDir, night);
    return n.found ? n.counts : null;
  } catch {
    return null;
  }
}

export function readStatus(config: RigConfig): Status {
  const nights = nightsOnDisk(config.runsDir);
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
    counts: Object.fromEntries(nights.map((n) => [n, countsFor(config.runsDir, n)])),
  };
}
