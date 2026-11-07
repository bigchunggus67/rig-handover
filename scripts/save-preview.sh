#!/usr/bin/env bash
# Save /digest/2026-10-28 from a locally started rig as one self-contained HTML file.
# Usage: scripts/save-preview.sh <out-file>      (env: PORT, default 8799; LANE_MARKER as rig reads it)
set -euo pipefail

out="${1:?usage: save-preview.sh <out-file>}"
port="${PORT:-8799}"
base="http://127.0.0.1:${port}"
log="$(mktemp)"

set -m # own process group for the server, so the whole pnpm/tsx/node tree can be stopped
PORT="$port" pnpm start >"$log" 2>&1 &
pid=$!

cleanup() {
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  rm -f "$log"
}
trap cleanup EXIT

ready=0
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "$base/health" 2>/dev/null; then ready=1; break; fi
  kill -0 "$pid" 2>/dev/null || { echo "rig exited early" >&2; exit 1; }
  sleep 0.5
done
[ "$ready" = 1 ] || { echo "rig did not answer /health within 30s" >&2; exit 1; }

mkdir -p "$(dirname "$out")"
curl -fsS "$base/digest/2026-10-28" -o "$out"

# Self-contained: no scripts, no src=, no href to another host.
if grep -qi '<script' "$out"; then echo "check failed: <script in page" >&2; exit 1; fi
if grep -qiE '(src|href)="(https?:)?//' "$out"; then echo "check failed: external src/href" >&2; exit 1; fi
if grep -qi ' src=' "$out"; then echo "check failed: src= in page" >&2; exit 1; fi

if grep -q 'class="marker">no marker set<' "$out"; then banner="no marker set"; else banner="marker shown"; fi
echo "preview saved: $(wc -c <"$out" | tr -d ' ') bytes, self-contained, banner: $banner"
