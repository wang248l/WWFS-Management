import { db } from "./db";
import { getJson } from "./team";

/**
 * 月度经营总览自动取数（2026-10-20 Wallace：「一个数据都没有……如何不让我手动录入」）。
 *
 * 打开 /kpi（或首页、数据录入页）时，对要显示的月份去 CRM / Marketing 各问一次当月数字，
 * 写进 MetricValue（source = crm / marketing）。同一个月 10 分钟内只问一次。
 * 人工在「数据录入」页填过的值（source = manual）不覆盖 —— 人工填的优先。
 */

const lastSync = new Map<string, number>();
const TTL_MS = 10 * 60 * 1000;

type CrmMonth = { values: { leadsReceived: number; newClients: number; conversionRate: number | null; revenue: number; dmReplies: number | null } };
type MktMonth = {
  values: {
    views: number | null;
    follower_growth: number | null;
    followers_from_videos: number | null;
    publish_deliveries: number | null;
    hits: number | null;
    ad_spend_cad: number | null;
    ad_leads: number | null;
  };
};

async function fetchMonth(period: string) {
  const crmBase = process.env.CRM_API_BASE?.replace(/\/$/, "");
  const mktBase = process.env.MARKETING_API_BASE?.replace(/\/$/, "");
  const [crm, mkt] = await Promise.all([
    crmBase && process.env.CRM_API_KEY
      ? getJson<CrmMonth>(`${crmBase}/api/admin/monthly-kpi?period=${period}`, { "x-api-key": process.env.CRM_API_KEY })
      : null,
    mktBase && process.env.MARKETING_API_KEY
      ? getJson<MktMonth>(`${mktBase}/api/agent/monthly-kpi?period=${period}`, { authorization: `Bearer ${process.env.MARKETING_API_KEY}` })
      : null,
  ]);
  return { crm: crm?.ok ? crm.data.values : null, mkt: mkt?.ok ? mkt.data.values : null };
}

/** 驾驶舱指标 key → 数值。null = 这个月算不出来（来源没数据），不写。 */
function mapValues(crm: CrmMonth["values"] | null, mkt: MktMonth["values"] | null) {
  const out: { key: string; value: number | null; source: "crm" | "marketing" }[] = [];
  if (crm) {
    out.push(
      { key: "leads_received", value: crm.leadsReceived, source: "crm" },
      { key: "new_clients", value: crm.newClients, source: "crm" },
      { key: "sales_conversion_rate", value: crm.conversionRate, source: "crm" },
      { key: "sales_revenue", value: crm.revenue, source: "crm" },
      { key: "dm_count", value: crm.dmReplies, source: "crm" },
    );
  }
  if (mkt) {
    const spend = mkt.ad_spend_cad;
    const leads = mkt.ad_leads;
    out.push(
      { key: "traffic", value: mkt.views, source: "marketing" },
      { key: "new_followers", value: mkt.follower_growth ?? mkt.followers_from_videos, source: "marketing" },
      { key: "videos_published", value: mkt.publish_deliveries, source: "marketing" },
      { key: "hit_videos", value: mkt.hits, source: "marketing" },
      { key: "ad_spend", value: spend, source: "marketing" },
      { key: "leads", value: leads, source: "marketing" },
      { key: "cost_per_lead", value: spend != null && leads ? Math.round((spend / leads) * 100) / 100 : null, source: "marketing" },
    );
    // 开口成本 = 投流花费 ÷ 私信回复（CRM 当日业绩里填的）
    if (crm?.dmReplies && spend != null) {
      out.push({ key: "cost_per_open", value: Math.round((spend / crm.dmReplies) * 100) / 100, source: "marketing" });
    }
  }
  return out;
}

export async function syncAutoKpi(periods: string[]): Promise<void> {
  const now = Date.now();
  const due = periods.filter((p) => now - (lastSync.get(p) || 0) > TTL_MS);
  if (!due.length) return;
  const metrics = await db.metric.findMany({ select: { id: true, key: true } });
  const idOf = new Map(metrics.map((m) => [m.key, m.id]));

  await Promise.all(
    due.map(async (period) => {
      const { crm, mkt } = await fetchMonth(period);
      if (!crm && !mkt) return; // 两边都没连上：不记时间，下次再试
      lastSync.set(period, now);
      const existing = await db.metricValue.findMany({ where: { period }, select: { metricId: true, source: true } });
      const manual = new Set(existing.filter((e) => e.source === "manual").map((e) => e.metricId));
      for (const { key, value, source } of mapValues(crm, mkt)) {
        const metricId = idOf.get(key);
        if (!metricId || value == null || !Number.isFinite(value) || manual.has(metricId)) continue;
        await db.metricValue.upsert({
          where: { metricId_period: { metricId, period } },
          update: { value, source },
          create: { metricId, period, value, source },
        });
      }
    }),
  );
}
