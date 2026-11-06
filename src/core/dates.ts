// PRECOG / Trend Radar · Dates for statistical periods.

/** "2026-09" or "2026-Q3" as the first day of that period (ms, UTC). */
export const periodStart = (t: string): number =>
  Date.parse(/Q\d$/.test(t) ? `${t.slice(0, 4)}-${String((+t.slice(-1) - 1) * 3 + 1).padStart(2, '0')}-01` : t + '-01');
