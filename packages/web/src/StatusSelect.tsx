import type { OutreachStatus } from "@st/shared";

export const STATUSES: OutreachStatus[] = ["new", "shortlisted", "contacted", "replied", "applied", "deal", "archived"];

export function StatusSelect({ value, onChange }: { value: OutreachStatus; onChange: (s: OutreachStatus) => void }) {
  return (
    <select className={`status s-${value}`} value={value} onChange={(e) => onChange(e.target.value as OutreachStatus)} aria-label="Outreach status">
      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}
