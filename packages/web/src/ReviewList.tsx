import { useEffect, useState } from "react";
import { api, date, eur, ROUND_LABEL, type ReviewItem } from "./api.ts";

/** Headlines the regex couldn't read well → fix the name and save, or dismiss. */
export function ReviewList({ onDone }: { onDone: () => void }) {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    api.review().then((r) => {
      setItems(r);
      setNames(Object.fromEntries(r.map((i) => [i._id, i.extraction.company ?? ""])));
    });
  }, []);

  const remove = (id: string) => setItems((list) => list?.filter((i) => i._id !== id) ?? null);
  const accept = async (i: ReviewItem) => {
    await api.accept(i._id, names[i._id]);
    remove(i._id);
    onDone();
  };
  const dismiss = async (i: ReviewItem) => {
    await api.dismiss(i._id);
    remove(i._id);
  };

  if (!items) return <div className="empty muted">Loading…</div>;
  if (items.length === 0) return <div className="empty"><p>Nothing to review 🎉</p></div>;

  return (
    <section className="review">
      <p className="muted">These headlines looked like funding news, but the company name wasn't clear. Type the name and save, or dismiss.</p>
      {items.map((i) => (
        <div key={i._id} className="review-item">
          <a href={i.url} target="_blank" rel="noreferrer" className="title">{i.title} ↗</a>
          <div className="muted small">
            {date(i.publishedAt)} · {ROUND_LABEL[i.extraction.round] ?? "—"} · {eur(i.extraction.amountEur)}
            {i.extraction.location.city ? ` · ${i.extraction.location.city}` : ""}
          </div>
          <div className="row">
            <input
              placeholder="Company name"
              value={names[i._id] ?? ""}
              onChange={(e) => setNames({ ...names, [i._id]: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && names[i._id]?.trim() && accept(i)}
            />
            <button onClick={() => accept(i)} disabled={!names[i._id]?.trim()}>Save as startup</button>
            <button className="link" onClick={() => dismiss(i)}>Not a funding round</button>
          </div>
        </div>
      ))}
    </section>
  );
}
