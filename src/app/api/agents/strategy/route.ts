import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentAuth, agentStatus, loadPromo } from "@/lib/office";
import { loadAiLog } from "@/lib/aiLog";
import { fetchCrm, fetchMarketing } from "@/lib/team";
import { cleanStrategy, loadAnswers, loadHistory, loadStrategy, saveStrategy } from "@/lib/strategy";

export const dynamic = "force-dynamic";

/**
 * AI 战略官 Kai 的接口（Bearer agent 钥匙，跟其他 agent 一样）。
 *
 * GET  → 定战略要看的全部反馈：每个员工的状态 / 看板 / 最近打卡、宣发 7 天数字、月度 KPI（近 6 个月）、
 *        AI 工作日志里卡住的和要人做的、老板对上周任务和拍板的回答、最近几周的战略存档，
 *        以及服务器上配了钥匙就顺手拉的 CRM 团队活动和 Marketing 运营汇总。
 * POST { "strategy": {...} } → 存本周战略，AI 员工的任务挂到各自看板（🎯），Kai 打一次卡。
 */
export async function GET(req: NextRequest) {
  const err = await agentAuth(req);
  if (err) return NextResponse.json({ error: err }, { status: 401 });
  const since = new Date(Date.now() - 14 * 86400_000);
  const [agents, staff, metrics, needs, promo, ai, current, answers, history, crm, mkt] = await Promise.all([
    db.agent.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        runs: { where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 10 },
        tasks: { orderBy: { updatedAt: "desc" }, take: 30 },
      },
    }),
    db.staff.findMany({ where: { active: true } }),
    db.metric.findMany({ include: { values: { orderBy: { period: "desc" }, take: 6 }, department: { select: { name: true } } } }),
    db.agentMessage.findMany({ where: { fromRole: "agent", kind: { in: ["blocker", "meeting"] }, resolvedAt: null }, include: { agent: { select: { key: true } } } }),
    loadPromo(),
    loadAiLog(),
    loadStrategy(),
    loadAnswers(),
    loadHistory(6),
    fetchCrm().catch(() => ({ ok: false as const, error: "crm failed" })),
    fetchMarketing().catch(() => ({ ok: false as const, error: "marketing failed" })),
  ]);
  return NextResponse.json({
    now: new Date().toISOString(),
    agents: agents.map((a) => ({
      key: a.key, name: a.name, department: a.department, title: a.title, duty: a.duty, schedule: a.schedule, host: a.host, active: a.active,
      status: agentStatus(a, a.runs[0] || null),
      runs: a.runs.map((r) => ({ at: r.createdAt, task: r.task, status: r.status, summary: r.summary, outputCount: r.outputCount })),
      tasks: a.tasks.map((t) => ({ title: t.title, status: t.status, note: t.note, updatedAt: t.updatedAt })),
      aiLog: ai.byAgent[a.key] ? { lastAt: ai.byAgent[a.key].lastAt, lastMsg: ai.byAgent[a.key].lastMsg, count24h: ai.byAgent[a.key].count24h, fail24h: ai.byAgent[a.key].fail24h, stuck: ai.byAgent[a.key].stuck.map((e) => e.msg).slice(0, 5) } : null,
    })),
    staff: staff.map((s) => ({ name: s.name, role: s.role, department: s.department })),
    needsOwner: needs.map((n) => ({ agent: n.agent.key, kind: n.kind, urgent: n.urgent, text: n.text, at: n.createdAt })),
    humanTodos: ai.human.map((e) => ({ msg: e.msg, fix: e.fix, at: e.ts })).slice(0, 20),
    promo7d: Object.fromEntries(Object.entries(promo).map(([k, v]) => [k, v.totals])),
    monthlyKpi: metrics.map((m) => ({ key: m.key, name: m.name, dept: m.department.name, unit: m.unit, values: m.values.map((v) => ({ period: v.period, value: v.value, note: v.note })) })),
    crm: crm.ok ? crm.data : { error: crm.error },
    marketing: mkt.ok ? mkt.data : { error: mkt.error },
    current,
    answers,
    history,
  });
}

export async function POST(req: NextRequest) {
  const err = await agentAuth(req);
  if (err) return NextResponse.json({ error: err }, { status: 401 });
  const b = await req.json().catch(() => null);
  const s = cleanStrategy(b?.strategy);
  if (typeof s === "string") return NextResponse.json({ error: s }, { status: 400 });
  const { carded } = await saveStrategy(s);
  return NextResponse.json({ ok: true, week: s.week, tasks: s.tasks?.length || 0, decisions: s.decisions?.length || 0, cardedTo: carded });
}
