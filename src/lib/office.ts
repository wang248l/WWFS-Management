import { db } from "./db";
import { hoursAgo, type AgentStatus } from "./team";

/**
 * WWFS办公室（2026-11-03 Wallace：「把现在每一个正在工作的部门做一套管理系统」
 * 「每个人负责一个单独的工作空间」）。进门按部门看人，点一个人进他的工位：
 * 打开他的工作空间、跟他说话、看他手上的任务。
 */

// 办公室里现在开着的部门（2026-11-03 Wallace：「我们现在只有社媒运营……顾问两个人，市场部的 Leo，
// 销售部加入销售经理 Bob，内容部改成会计 Tina」）。不在这里的部门（增员部、内容部）的人只在名单页和仪表盘里。
export const OFFICE_DEPTS = ["社媒运营部", "出镜顾问", "市场部", "销售部", "财务部"];
export const DEPT_ORDER = OFFICE_DEPTS;
export const DEPT_ICON: Record<string, string> = { 社媒运营部: "📱", 运营部: "🧭", 市场部: "📣", 增员部: "🤝", 内容部: "🎬", 出镜顾问: "🎙️", 销售部: "💼", 财务部: "🧮" };

// 还没人坐的位子（2026-11-03 Wallace：「销售我可能还会单独找一个人」）。看板「移交销售」的客户都归这里。
export const OPEN_SEATS: { department: string; title: string; note: string }[] = []; // 销售位已由 Bob 接手

export const PROMO_FIELDS = [
  { key: "posts", label: "发布" },
  { key: "impressions", label: "曝光" },
  { key: "followers", label: "新粉" },
  { key: "dms", label: "私信" },
  { key: "leads", label: "留资" },
  { key: "signups", label: "网课报名" },
] as const;
export const PROMO_AGENTS = ["mark", "leo"];

export { TASK_COLUMNS, isTaskStatus, type TaskStatus } from "./officeConst";

export const STATUS_LABEL: Record<AgentStatus, { label: string; cls: string; dot: string }> = {
  ok: { label: "在岗", cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  late: { label: "超时", cls: "bg-red-50 text-red-700", dot: "bg-red-500" },
  error: { label: "出错", cls: "bg-red-50 text-red-700", dot: "bg-red-500" },
  never: { label: "未上岗", cls: "bg-amber-50 text-amber-700", dot: "bg-amber-400" },
  paused: { label: "停用", cls: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
};

/** 只看本地打卡的状态（办公室页不去拉 CRM/Marketing，打开要快）。 */
/** 有没有排上定时任务（「待定」「未填」不算）。 */
export function hasSchedule(a: { schedule?: string | null }): boolean {
  return !!a.schedule && !/待定|未填/.test(a.schedule);
}

export function agentStatus(a: { active: boolean; everyHours: number; graceHours: number; schedule?: string | null }, lastRun?: { status: string; createdAt: Date; finishedAt: Date | null } | null): AgentStatus {
  if (!a.active) return "paused";
  // 2026-11-05 Wallace：「有定时任务的人不要显示在睡觉，只有目前没有任何定时任务的人才显示睡觉……就显示正在工作，像 Amelia 一样」
  if (!lastRun) return hasSchedule(a) ? "ok" : "never";
  const h = hoursAgo((lastRun.finishedAt || lastRun.createdAt).toISOString())!;
  if (h > a.everyHours + a.graceHours) return "late";
  if (lastRun.status === "error") return "error";
  return "ok";
}

export async function loadOffice() {
  const [agents, staff, needs] = await Promise.all([
    db.agent.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        runs: { orderBy: { createdAt: "desc" }, take: 1 },
        tasks: { orderBy: [{ order: "asc" }, { updatedAt: "desc" }] },
        messages: { where: { fromRole: "owner", readAt: null }, select: { id: true } },
      },
    }),
    db.staff.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
    db.agentMessage.findMany({
      where: { fromRole: "agent", kind: { in: ["blocker", "meeting"] }, resolvedAt: null },
      orderBy: [{ urgent: "desc" }, { createdAt: "desc" }],
      include: { agent: { select: { key: true, name: true, avatar: true } } },
    }),
  ]);
  const agentRows = agents.map((a) => ({
    ...a,
    status: agentStatus(a, a.runs[0]),
    lastRun: a.runs[0] || null,
    unread: a.messages.length,
    needs: needs.filter((n) => n.agentId === a.id).length,
    // 24 小时内有卡挪到「完成」或「移交销售」= 有好消息，小人开心跳一下
    happy: a.tasks.some((t) => (t.status === "done" || t.status === "handoff") && Date.now() - t.updatedAt.getTime() < 86400_000),
  }));
  const depts = new Set<string>([
    ...agentRows.map((a) => a.department || "未分部门"),
    ...staff.map((s) => s.department || "未分部门"),
    ...OPEN_SEATS.map((s) => s.department),
  ]);
  const ordered = [...depts].filter((d) => OFFICE_DEPTS.includes(d)).sort((x, y) => {
    const ix = DEPT_ORDER.indexOf(x), iy = DEPT_ORDER.indexOf(y);
    return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
  });
  return {
    agents: agentRows,
    departments: ordered.map((d) => ({
      name: d,
      icon: DEPT_ICON[d] || "🏢",
      agents: agentRows.filter((a) => (a.department || "未分部门") === d),
      staff: staff.filter((s) => (s.department || "未分部门") === d),
      openSeats: OPEN_SEATS.filter((s) => s.department === d),
    })),
    needs,
    handoffCount: agentRows.reduce((n, a) => n + a.tasks.filter((t) => t.status === "handoff").length, 0),
  };
}

export function agentAuth(req: Request): string | null {
  const token = process.env.INGEST_TOKEN;
  if (!token) return "disabled (INGEST_TOKEN not set)";
  if ((req.headers.get("authorization") || "") !== `Bearer ${token}`) return "unauthorized";
  return null;
}

/** 近 7 天宣发数字，按 agent 汇总 + 每天明细。 */
export async function loadPromo(keys: string[] = PROMO_AGENTS) {
  // 只按 agent 分；办公室首页要合计时自己加
  const since = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const rows = await db.promoDaily.findMany({ where: { agentKey: { in: keys }, date: { gte: since } }, orderBy: { date: "desc" } });
  const dates = [...Array(7)].map((_, i) => new Date(Date.now() - (6 - i) * 86400_000).toISOString().slice(0, 10));
  const out: Record<string, { days: number; totals: Record<string, number | null>; rows: typeof rows; series: Record<string, (number | null)[]> }> = {};
  for (const k of keys) {
    const mine = rows.filter((r) => r.agentKey === k);
    const totals: Record<string, number | null> = {};
    for (const f of PROMO_FIELDS) {
      const vals = mine.map((r) => (r as any)[f.key]).filter((v) => v !== null && v !== undefined) as number[];
      totals[f.key] = vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    }
    const series: Record<string, (number | null)[]> = {};
    for (const f of PROMO_FIELDS) series[f.key] = dates.map((d) => ((mine.find((r) => r.date === d) as any)?.[f.key] ?? null));
    out[k] = { days: mine.length, totals, rows: mine, series };
  }
  return out;
}
