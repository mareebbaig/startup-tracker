import type { Meta } from "./api.ts";
import { ROUND_LABEL } from "./api.ts";

export interface FilterState extends Record<string, string> {
  q: string;
  city: string;
  round: string;
  status: string;
  minAmount: string;
  days: string;
  minScore: string;
  hiring: string;
  dev: string;
  tech: string;
  sort: string;
}

export const DEFAULT_FILTERS: FilterState = {
  q: "", city: "", round: "", status: "", minAmount: "", days: "", minScore: "",
  hiring: "", dev: "", tech: "", sort: "newest",
};

interface Props {
  value: FilterState;
  onChange: (f: FilterState) => void;
  meta: Meta | null;
}

export function Filters({ value: f, onChange, meta }: Props) {
  const set = (k: keyof FilterState) => (e: { target: { value: string } }) => onChange({ ...f, [k]: e.target.value });
  const toggle = (k: keyof FilterState, on: string) => () => onChange({ ...f, [k]: f[k] ? "" : on });
  const changed = JSON.stringify(f) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <section className="filters">
      <input className="search" placeholder="Search company…" value={f.q} onChange={set("q")} />

      <select value={f.city} onChange={set("city")} aria-label="City">
        <option value="">All cities</option>
        {meta?.cities.map((c) => <option key={c}>{c}</option>)}
      </select>

      <select value={f.round} onChange={set("round")} aria-label="Round">
        <option value="">All rounds</option>
        {Object.entries(ROUND_LABEL).filter(([k]) => k !== "unknown").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>

      <select value={f.minAmount} onChange={set("minAmount")} aria-label="Min amount">
        <option value="">Any amount</option>
        <option value="1000000">≥ €1M</option>
        <option value="5000000">≥ €5M</option>
        <option value="20000000">≥ €20M</option>
      </select>

      <select value={f.days} onChange={set("days")} aria-label="Announced">
        <option value="">Any time</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
        <option value="180">Last 6 months</option>
      </select>

      <select value={f.status} onChange={set("status")} aria-label="Status">
        <option value="">Active (not archived)</option>
        {meta?.statuses.map((s) => (
          <option key={s} value={s}>{s} {meta.byStatus[s] ? `(${meta.byStatus[s]})` : ""}</option>
        ))}
      </select>

      <button className={`chip ${f.hiring ? "on" : ""}`} onClick={toggle("hiring", "1")}>Hiring</button>
      <button className={`chip ${f.dev ? "on" : ""}`} onClick={toggle("dev", "1")}>Dev roles</button>
      <button className={`chip ${f.minScore ? "on" : ""}`} onClick={toggle("minScore", "50")}>Good match</button>
      <button className={`chip ${f.tech ? "on" : ""}`} onClick={toggle("tech", "all")} title="Include startups not tagged as tech">Incl. non-tech</button>

      <span className="spacer" />
      <select value={f.sort} onChange={set("sort")} aria-label="Sort">
        <option value="newest">Newest round</option>
        <option value="score">Best match</option>
        <option value="amount">Biggest round</option>
        <option value="name">Name A–Z</option>
      </select>
      {changed && <button className="link" onClick={() => onChange(DEFAULT_FILTERS)}>Reset</button>}
    </section>
  );
}
