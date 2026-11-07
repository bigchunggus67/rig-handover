import type { DigestRow } from '../digest/types.js';

const dash = '—';

function Row({ row }: { row: DigestRow }) {
  const failed = row.lastStatus === 'fail';
  return (
    <tr>
      <td>{row.job}</td>
      <td>{row.owner ?? dash}</td>
      <td>{row.runs}</td>
      <td class={row.retries >= 3 ? 'warn' : undefined}>{row.retries}</td>
      <td class={failed ? 'warn' : undefined}>{row.lastStatus}</td>
      <td class={failed ? 'warn' : undefined}>{row.lastError ?? dash}</td>
      <td>{row.first}</td>
      <td>{row.last}</td>
    </tr>
  );
}

export function DigestPage({ night, rows, badLines }: { night: string; rows: DigestRow[]; badLines: number }) {
  return (
    <>
      <h1>digest · {night}</h1>
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Row row={row} />
            ))}
          </tbody>
        </table>
      )}
      {badLines > 0 ? (
        <p class="mute">
          {badLines} {badLines === 1 ? "line didn't" : "lines didn't"} parse
        </p>
      ) : null}
    </>
  );
}

export function NoRunLog({ night }: { night: string }) {
  return (
    <>
      <h1>digest · {night}</h1>
      <p class="mute">no run log for {night}</p>
    </>
  );
}
