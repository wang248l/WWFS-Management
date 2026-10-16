import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  currentPeriod,
  previousPeriod,
  isValidPeriod,
  periodLabel,
  recentPeriods,
  formatValue,
  computeDelta,
  formatDeltaPct,
  type Format,
} from "@/lib/metrics";
import PeriodPicker from "../_components/PeriodPicker";

export const dynamic = "force-dynamic";

function firstName(raw: string): string {
  const noEmail = raw.split("@")[0];
  const first = noEmail.split(/[ ._-]/)[0] || noEmail;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export default async function Dashboard({ searchParams }: { searchParams: { period?: string } }) {
  const me = await getCurrentUser();
  const name = me ? firstName(me.displayName || me.username) : "管理员";

  const period = searchParams.period && isValidPeriod(searchParams.period) ? searchParams.period : currentPeriod();
  const prev = previousPeriod(period);

  const periods = recentPeriods(12, currentPeriod());
  // ensure the selected period appears even if older than 12 months
  if (!periods.includes(period)) periods.push(period);
  const labels: Record<string, string> = {};
  periods.forEach((p) => (labels[p] = periodLabel(p)));

  const departments = await db.department.findMany({
    orderBy: { order: "asc" },
    include: { metrics: { orderBy: { order: "asc" } } },
  });

  // Pull this-period + previous-period values in one query each, index by metricId.
  const [curVals, prevVals] = await Promise.all([
    db.metricValue.findMany({ where: { period }, select: { metricId: true, value: true } }),
    db.metricValue.findMany({ where: { period: prev }, select: { metricId: true, value: true } }),
  ]);
  const cur = new Map(curVals.map((v) => [v.metricId, v.value]));
  const pre = new Map(prevVals.map((v) => [v.metricId, v.value]));

  const totalMetrics = departments.reduce((n, d) => n + d.metrics.length, 0);
  const filledThisMonth = curVals.length;

  return (
    <div className="space-y-6">
      {/* Header band */}
      <div className="rounded-xl bg-gradient-to-br from-brand-50 to-sky-50 border border-brand-100 px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">📊 经营总览 · {name}</h1>
            <p className="mt-1 text-sm text-stone-600">
              对比 <span className="font-medium">{periodLabel(period)}</span> 与上月{" "}
              <span className="font-medium">{periodLabel(prev)}</span> 的各部门关键指标。
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <PeriodPicker periods={periods} current={period} labels={labels} basePath="/kpi" />
            <span className="text-xs text-stone-500">
              本月已录入 {filledThisMonth}/{totalMetrics} 项
            </span>
          </div>
        </div>
      </div>

      {departments.length === 0 ? (
        <div className="card p-8 text-center text-stone-500">
          暂无部门/指标。请检查 seed 是否执行,或前往{" "}
          <Link href="/data" className="text-brand-700 hover:underline">数据录入</Link>。
        </div>
      ) : (
        departments.map((dept) => (
          <section key={dept.id} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">
                <span className="mr-2">{dept.icon}</span>
                {dept.name}
              </h2>
              <Link href={`/data?period=${period}`} className="text-sm text-brand-700 hover:underline">
                录入本月数据 →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {dept.metrics.map((m) => {
                const c = cur.get(m.id) ?? null;
                const p = pre.get(m.id) ?? null;
                const d = computeDelta(c, p, m.betterWhen);
                const toneClass =
                  d.tone === "good" ? "delta-good" : d.tone === "bad" ? "delta-bad" : "delta-flat";
                const arrow = d.abs === null ? "" : d.abs > 0 ? "▲" : d.abs < 0 ? "▼" : "■";
                return (
                  <div key={m.id} className="card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="label" title={m.description || undefined}>
                        {m.name}
                      </div>
                      {d.abs !== null && (
                        <span className={"badge " + toneClass} title={`上月 ${formatValue(p, m.format as Format, m.unit)}`}>
                          {arrow} {formatDeltaPct(d)}
                        </span>
                      )}
                    </div>
                    <div className="text-2xl font-semibold mt-1.5 truncate">
                      {formatValue(c, m.format as Format, m.unit)}
                    </div>
                    <div className="text-xs text-stone-500 mt-1 truncate">
                      上月 {formatValue(p, m.format as Format, m.unit)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      <p className="text-xs text-stone-400 pt-2">
        颜色说明:绿色 = 朝好的方向变化,红色 = 朝坏的方向变化(开口成本、单客资成本越低越好)。
        数据来源:CRM(销售)、Marketing 系统(流量/投流)、月底 Claude 抓取(私信)及人工录入。
      </p>
    </div>
  );
}
