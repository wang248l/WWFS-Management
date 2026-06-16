/**
 * Period + metric helpers. A "period" is a calendar month string "YYYY-MM"
 * (the month a number describes). Month-over-month comparison is just the
 * current period's value minus the previous period's value.
 */

/** Current month in Toronto local time as "YYYY-MM". Server runs UTC. */
export function currentPeriod(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    if (y && m) return `${y}-${m}`;
  } catch {
    /* fall through */
  }
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The month before a given "YYYY-MM". */
export function previousPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  const date = new Date(Date.UTC(y, m - 1, 1));
  date.setUTCMonth(date.getUTCMonth() - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Validate a "YYYY-MM" string. */
export function isValidPeriod(period: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
}

/** Human-friendly month label, e.g. "2026-06" → "2026 年 6 月". */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-");
  if (!y || !m) return period;
  return `${y} 年 ${Number(m)} 月`;
}

/** Build a list of recent periods (newest first), for the month picker. */
export function recentPeriods(count = 12, from?: string): string[] {
  const out: string[] = [];
  let p = from && isValidPeriod(from) ? from : currentPeriod();
  for (let i = 0; i < count; i++) {
    out.push(p);
    p = previousPeriod(p);
  }
  return out;
}

export type Format = "number" | "percent" | "currency";

/** Render a metric value for display, honouring its format + unit. */
export function formatValue(value: number | null | undefined, format: Format, unit?: string | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (format === "percent") {
    return `${trimNum(value)}%`;
  }
  if (format === "currency") {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    return `${sign}$${groupThousands(abs)}`;
  }
  // plain number
  const base = abs1k(value);
  return unit ? `${base}${unit}` : base;
}

function trimNum(n: number): string {
  // up to 2 decimals, no trailing zeros
  return String(Math.round(n * 100) / 100);
}

function groupThousands(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Compact large counts: 12345 → "12.3k", 2_400_000 → "2.4M". */
export function abs1k(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${Math.round(abs * 100) / 100}`;
}

export type Delta = {
  /** absolute change (current - previous), null if no previous value */
  abs: number | null;
  /** percent change, null if no previous or previous is 0 */
  pct: number | null;
  /** "good" | "bad" | "flat" | "unknown" — drives colour */
  tone: "good" | "bad" | "flat" | "unknown";
};

/**
 * Compute month-over-month delta and whether it's good/bad given the metric's
 * `betterWhen` direction ("up" | "down" | "neutral").
 */
export function computeDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  betterWhen: string
): Delta {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return { abs: null, pct: null, tone: "unknown" };
  }
  const abs = current - previous;
  const pct = previous === 0 ? null : (abs / Math.abs(previous)) * 100;

  if (abs === 0) return { abs, pct, tone: "flat" };
  if (betterWhen === "neutral") return { abs, pct, tone: "flat" };

  const wentUp = abs > 0;
  const good = betterWhen === "up" ? wentUp : !wentUp;
  return { abs, pct, tone: good ? "good" : "bad" };
}

/** Format a delta percent for display, e.g. +12.3% / -4% / 新增 / —. */
export function formatDeltaPct(d: Delta): string {
  if (d.abs === null) return "—";
  if (d.pct === null) {
    // previous was 0 → it's brand new movement
    return d.abs > 0 ? "新增" : d.abs < 0 ? "归零" : "持平";
  }
  const sign = d.pct > 0 ? "+" : "";
  return `${sign}${Math.round(d.pct * 10) / 10}%`;
}
