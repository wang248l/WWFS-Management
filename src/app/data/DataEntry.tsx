"use client";

import { useState } from "react";

type Row = {
  key: string;
  name: string;
  unit: string | null;
  format: string;
  defaultSource: string;
  description: string | null;
  value: number | null;
  note: string | null;
};

type Group = { dept: string; icon: string | null; rows: Row[] };

/**
 * Inline editor for one period's metric values. Each input saves on blur via
 * POST /api/values. Empty value deletes the reading. Save state is shown per
 * row so the user knows it persisted.
 */
export default function DataEntry({ period, groups }: { period: string; groups: Group[] }) {
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.dept} className="space-y-3">
          <h2 className="text-lg font-semibold">
            <span className="mr-2">{g.icon}</span>
            {g.dept}
          </h2>
          <div className="card divide-y divide-stone-100">
            {g.rows.map((r) => (
              <MetricRow key={r.key} period={period} row={r} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "人工",
  cron: "Claude 抓取",
  crm: "CRM",
  marketing: "Marketing",
};

function MetricRow({ period, row }: { period: string; row: Row }) {
  const [value, setValue] = useState<string>(row.value === null ? "" : String(row.value));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    try {
      const res = await fetch("/api/values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricKey: row.key,
          period,
          value: value === "" ? null : Number(value),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate" title={row.description || undefined}>
          {row.name}
        </div>
        <div className="text-xs text-stone-400 mt-0.5">
          来源默认 {SOURCE_LABEL[row.defaultSource] || row.defaultSource}
          {row.note ? ` · ${row.note}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {row.format === "currency" && <span className="text-stone-400 text-sm">$</span>}
        <input
          type="number"
          step="any"
          inputMode="decimal"
          className="input max-w-[140px] text-right"
          value={value}
          placeholder="—"
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        {row.unit && row.format !== "currency" && (
          <span className="text-stone-400 text-sm w-6">{row.unit}</span>
        )}
        <span className="text-xs w-12 text-right">
          {status === "saving" && <span className="text-stone-400">保存中</span>}
          {status === "saved" && <span className="text-emerald-600">已保存</span>}
          {status === "error" && <span className="text-red-600">失败</span>}
        </span>
      </div>
    </div>
  );
}
