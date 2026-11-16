import type { OutreachStatus } from "@st/shared";
import { api, date, eur, lastRound, ROUND_LABEL, type S } from "./api.ts";
import { StatusSelect } from "./StatusSelect.tsx";

interface Props {
  rows: S[];
  loading: boolean;
  selectedId?: string;
  onSelect: (s: S) => void;
  onChanged: (s: S) => void;
}

export function Score({ value }: { value?: number }) {
  if (value === undefined) return <span className="score none" title="Not checked yet">·</span>;
  const level = value >= 60 ? "high" : value >= 35 ? "mid" : "low";
  return <span className={`score ${level}`} title="Match score (0–100)">{value}</span>;
}

export function StartupTable({ rows, loading, selectedId, onSelect, onChanged }: Props) {
  const setStatus = async (s: S, status: OutreachStatus) => onChanged(await api.update(s._id, { status }));

  if (!loading && rows.length === 0) {
    return (
      <div className="empty">
        <p>No startups match these filters.</p>
        <p className="muted">Run <code>npm run ingest</code> to fetch news, or reset the filters.</p>
      </div>
    );
  }

  return (
    <div className={`table-wrap ${loading ? "loading" : ""}`}>
      <table>
        <thead>
          <tr>
            <th title="Match score">Fit</th>
            <th>Company</th>
            <th>City</th>
            <th>Round</th>
            <th className="num">Amount</th>
            <th>Date</th>
            <th>Hiring</th>
            <th>My stack</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const r = lastRound(s);
            const roles = s.careers?.roles ?? [];
            const dev = roles.filter((x) => x.isDev).length;
            return (
              <tr key={s._id} className={s._id === selectedId ? "sel" : ""} onClick={() => onSelect(s)}>
                <td><Score value={s.match?.score} /></td>
                <td className="name">
                  <strong>{s.name}</strong>
                  <span className="sectors">{s.sectors.slice(0, 3).join(" · ")}</span>
                </td>
                <td>{s.city ?? <span className="muted">—</span>}</td>
                <td>{ROUND_LABEL[r?.round ?? "unknown"]}</td>
                <td className="num">{eur(r?.amountEur)}</td>
                <td className="muted">{date(r?.announcedAt)}</td>
                <td>
                  {s.careers ? (
                    roles.length ? <span><b className={dev ? "dev" : ""}>{dev}</b> dev / {roles.length}</span> : <span className="muted">none open</span>
                  ) : (
                    <span className="muted">not checked</span>
                  )}
                </td>
                <td>
                  <div className="stack">
                    {s.match?.stack.map((t) => <span key={t} className="tag mine">{t}</span>)}
                  </div>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <StatusSelect value={s.outreach.status} onChange={(v) => setStatus(s, v)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

