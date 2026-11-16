import type { Round } from "@st/shared";

const RULES: [RegExp, Round][] = [
  [/\bpre[-\s]?seed/i, "pre-seed"],
  [/\bseed\b|\bseed-/i, "seed"],
  [/\bseries[-\s]?a\b/i, "series-a"],
  [/\bseries[-\s]?b\b/i, "series-b"],
  [/\bseries[-\s]?[c-h]\b/i, "series-c+"],
  [/wachstumsfinanzierung|growth (round|funding|equity)|\bseries[-\s]?(c|d|e)\b/i, "growth"],
];

/** Title first, then text. Order matters: "pre-seed" before "seed". */
export function extractRound(title: string, text: string): Round {
  for (const src of [title, text]) {
    for (const [re, round] of RULES) if (re.test(src)) return round;
  }
  return "unknown";
}
