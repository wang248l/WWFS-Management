import { db } from "@/lib/db";
import { currentPeriod, isValidPeriod, periodLabel, recentPeriods } from "@/lib/metrics";
import PeriodPicker from "../_components/PeriodPicker";
import DataEntry from "./DataEntry";
import { syncAutoKpi } from "@/lib/autoKpi";

export const dynamic = "force-dynamic";

export default async function DataPage({ searchParams }: { searchParams: { period?: string } }) {
  const period =
    searchParams.period && isValidPeriod(searchParams.period) ? searchParams.period : currentPeriod();

  await syncAutoKpi([period]);

  const periods = recentPeriods(12, currentPeriod());
  if (!periods.includes(period)) periods.push(period);
  const labels: Record<string, string> = {};
  periods.forEach((p) => (labels[p] = periodLabel(p)));

  const departments = await db.department.findMany({
    orderBy: { order: "asc" },
    include: { metrics: { orderBy: { order: "asc" } } },
  });

  const vals = await db.metricValue.findMany({
    where: { period },
    select: { metricId: true, value: true, note: true },
  });
  const byMetric = new Map(vals.map((v) => [v.metricId, v]));

  const groups = departments.map((dept) => ({
    dept: dept.name,
    icon: dept.icon,
    rows: dept.metrics.map((m) => {
      const v = byMetric.get(m.id);
      return {
        key: m.key,
        name: m.name,
        unit: m.unit,
        format: m.format,
        defaultSource: m.defaultSource,
        description: m.description,
        value: v ? v.value : null,
        note: v?.note ?? null,
      };
    }),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">数据录入</h1>
          <p className="mt-1 text-sm text-stone-600">
            录入 / 修改 <span className="font-medium">{periodLabel(period)}</span> 的指标。
            输入后离开输入框自动保存;清空则删除该项。
          </p>
        </div>
        <PeriodPicker periods={periods} current={period} labels={labels} basePath="/data" />
      </div>

      <DataEntry period={period} groups={groups} />

      <p className="text-xs text-stone-400">
        提示:CRM / Marketing / Claude 抓取的指标通常由系统或定时任务自动填入;这里手动录入的部分主要是
        成本、业绩等系统拿不到的数据。手动修改会把来源标记为「人工」。
      </p>
    </div>
  );
}
