import { useCallback, useEffect, useState } from "react";
import { ago, api, type Meta, type S } from "./api.ts";
import { DetailPanel } from "./DetailPanel.tsx";
import { DEFAULT_FILTERS, Filters, type FilterState } from "./Filters.tsx";
import { ReviewList } from "./ReviewList.tsx";
import { StartupTable } from "./StartupTable.tsx";

type Tab = "startups" | "review";

export function App() {
  const [tab, setTab] = useState<Tab>("startups");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<S[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [selected, setSelected] = useState<S | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, m] = await Promise.all([api.list(filters), api.meta()]);
      setRows(list);
      setMeta(m);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(load, 200); // small debounce for the search box
    return () => clearTimeout(t);
  }, [load]);

  /** Replace one row after an edit (status, notes, enrich) */
  const onChanged = (s: S) => {
    setRows((r) => r.map((x) => (x._id === s._id ? s : x)));
    setSelected((cur) => (cur?._id === s._id ? s : cur));
    api.meta().then(setMeta).catch(() => {});
  };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>Startup Tracker</h1>
          <span className="muted">German tech startups that just raised · last run {ago(meta?.lastRunAt)}</span>
        </div>
        <nav className="tabs">
          <button className={tab === "startups" ? "on" : ""} onClick={() => setTab("startups")}>
            Startups <span className="count">{rows.length}</span>
          </button>
          <button className={tab === "review" ? "on" : ""} onClick={() => setTab("review")}>
            Review {meta?.reviewOpen ? <span className="count warn">{meta.reviewOpen}</span> : null}
          </button>
        </nav>
      </header>

      {error && <div className="error">Could not load data: {error}. Is the API running (npm run dev)?</div>}

      {tab === "startups" ? (
        <>
          <Filters value={filters} onChange={setFilters} meta={meta} />
          <main className={`main ${selected ? "with-panel" : ""}`}>
            <StartupTable rows={rows} loading={loading} selectedId={selected?._id} onSelect={setSelected} onChanged={onChanged} />
            {selected && <DetailPanel s={selected} onClose={() => setSelected(null)} onChanged={onChanged} />}
          </main>
        </>
      ) : (
        <ReviewList onDone={load} />
      )}
    </div>
  );
}
