"use client";

import { useRouter } from "next/navigation";

/**
 * Month selector that navigates to ?period=YYYY-MM on change. Server component
 * re-renders with the chosen month. `basePath` lets the same picker drive both
 * the dashboard ("/") and the data-entry page ("/data").
 */
export default function PeriodPicker({
  periods,
  current,
  labels,
  basePath = "/",
}: {
  periods: string[];
  current: string;
  labels: Record<string, string>;
  basePath?: string;
}) {
  const router = useRouter();
  return (
    <select
      className="input max-w-[180px]"
      value={current}
      onChange={(e) => {
        const sep = basePath.includes("?") ? "&" : "?";
        router.push(`${basePath}${sep}period=${e.target.value}`);
      }}
    >
      {periods.map((p) => (
        <option key={p} value={p}>
          {labels[p] || p}
        </option>
      ))}
    </select>
  );
}
