import { useEffect, useState } from "react";
import { MY_STACK } from "@st/shared";
import { ago, api, date, eur, ROUND_LABEL, type S } from "./api.ts";
import { Score } from "./StartupTable.tsx";
import { StatusSelect } from "./StatusSelect.tsx";

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

/** LinkedIn people search — just a link, nothing is scraped */
const linkedin = (person: string, company: string) =>
  `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${person} ${company}`)}`;

export function DetailPanel({ s, onClose, onChanged }: { s: S; onClose: () => void; onChanged: (s: S) => void }) {
  const [notes, setNotes] = useState(s.outreach.notes ?? "");
  const [enriching, setEnriching] = useState(false);
  const [log, setLog] = useState<string[] | null>(null);
  const [website, setWebsite] = useState(s.website ?? "");

  useEffect(() => {
    setNotes(s.outreach.notes ?? "");
    setWebsite(s.website ?? "");
    setLog(null);
  }, [s._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveNotes = async () => {
    if (notes !== (s.outreach.notes ?? "")) onChanged(await api.update(s._id, { notes }));
  };
  const saveWebsite = async () => {
    if (website !== (s.website ?? "")) onChanged(await api.update(s._id, { website }));
  };
  const enrich = async () => {
    setEnriching(true);
    try {
      const r = await api.enrich(s._id);
      onChanged(r.startup);
      setLog(r.log);
    } catch (e) {
      setLog([`Error: ${(e as Error).message}`]);
    } finally {
      setEnriching(false);
    }
  };

  const rounds = [...s.rounds].sort((a, b) => new Date(b.announcedAt).getTime() - new Date(a.announcedAt).getTime());
  const roles = [...(s.careers?.roles ?? [])].sort((a, b) => Number(b.isDev) - Number(a.isDev));

  return (
    <aside className="panel">
      <div className="panel-head">
        <div>
          <h2>{s.name}</h2>
          <div className="muted">
            {s.city ?? "City unknown"} · {s.sectors.join(", ") || "no sector tags"}
          </div>
        </div>
        <button className="icon" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="row">
        <Score value={s.match?.score} />
        <StatusSelect value={s.outreach.status} onChange={async (status) => onChanged(await api.update(s._id, { status }))} />
        {s.outreach.contactedAt && <span className="muted">contacted {date(s.outreach.contactedAt)}</span>}
      </div>

      <h3>Website</h3>
      <div className="row">
        {s.website && <a href={s.website} target="_blank" rel="noreferrer">{host(s.website)} ↗</a>}
        <input className="grow" placeholder="https://… (fix or add by hand)" value={website} onChange={(e) => setWebsite(e.target.value)} onBlur={saveWebsite} />
      </div>

      <h3>Funding</h3>
      <ul className="rounds">
        {rounds.map((r, i) => (
          <li key={i}>
            <div>
              <b>{ROUND_LABEL[r.round]}</b> {eur(r.amountEur)} <span className="muted">· {date(r.announcedAt)}</span>
              {r.currency && r.currency !== "EUR" && <span className="muted"> (orig. {r.currency})</span>}
            </div>
            {r.investors.length > 0 && <div className="muted small">Investors: {r.investors.join(", ")}</div>}
            <div className="small">
              {r.sources.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer">{host(u)} ↗</a>)}
            </div>
          </li>
        ))}
      </ul>

      <h3>
        Jobs
        {s.careers?.url && <a className="small" href={s.careers.url} target="_blank" rel="noreferrer">{s.careers.ats ?? "careers"} ↗</a>}
      </h3>
      {s.careers && !s.careers.verified && (
        <p className="warn-box small">Job board found by guessing the name — check it's really this company.</p>
      )}
      {!s.careers ? (
        <p className="muted">Not checked yet.</p>
      ) : roles.length === 0 ? (
        <p className="muted">No open roles found{s.careers.url ? " (check the careers page by hand)" : ""}.</p>
      ) : (
        <ul className="roles">
          {roles.slice(0, 25).map((r, i) => (
            <li key={i} className={r.isDev ? "dev" : ""}>
              {r.url ? <a href={r.url} target="_blank" rel="noreferrer">{r.title}</a> : r.title}
              {r.location && <span className="muted small"> · {r.location}</span>}
            </li>
          ))}
          {roles.length > 25 && <li className="muted">+ {roles.length - 25} more</li>}
        </ul>
      )}
      {s.careers?.stack.length ? (
        <div className="stack wrap">
          {s.careers.stack.map((t) => <span key={t} className={`tag ${MY_STACK.includes(t) ? "mine" : ""}`}>{t}</span>)}
        </div>
      ) : null}

      <h3>People</h3>
      {s.contacts?.length ? (
        <ul className="people">
          {s.contacts.map((c) => (
            <li key={c.name}>
              <a href={linkedin(c.name, s.name)} target="_blank" rel="noreferrer">{c.name}</a> <span className="muted">· {c.role}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No names found in the articles.</p>
      )}

      <h3>Notes</h3>
      <textarea rows={4} value={notes} placeholder="e.g. wrote CTO on LinkedIn, follow up Friday" onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} />

      <div className="row foot">
        <button onClick={enrich} disabled={enriching}>{enriching ? "Checking… (can take ~30 s)" : "Re-check website & jobs"}</button>
        <span className="muted small">checked {ago(s.enrichedAt as unknown as string)}</span>
      </div>
      {s.enrichError && <p className="warn-box small">Last check failed: {s.enrichError}</p>}
      {log && <pre className="log">{log.join("\n")}</pre>}
    </aside>
  );
}
