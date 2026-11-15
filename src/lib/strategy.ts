import { db } from "./db";

/**
 * AI 战略官 Kai（2026-11-15 Wallace：「能否搭建一个 AI 定战略，我只负责执行或者找人执行」）。
 *
 * 每周日晚上 Kai（云端定时任务）先 GET /api/agents/strategy 拿全公司的反馈数据，
 * 定下周的主线、OKR、任务（老板亲自做 / 找人做 / AI 员工做）和要老板拍板的事，再 POST 回来。
 * 办公室 /strategy 页显示；分给 AI 员工的任务自动变成他们看板上的「🎯」卡；
 * 老板在页面上点「做完了」或选拍板选项，Kai 下周复盘时读到。
 *
 * 全部存在 Setting 表里（不改数据库结构）：
 *   strategy:current        本周战略 JSON
 *   strategy:week:<周>      每周存档（复盘用）
 *   strategy:answers        老板的勾选和拍板 { "<周>:<id>": { done?, choice?, note?, at } }
 */

export type StrategyKR = { id: string; text: string; current?: number | null; target?: number | null; unit?: string };
export type StrategyOKR = { id: string; objective: string; krs: StrategyKR[] };
export type StrategyTask = {
  id: string;
  title: string;
  lane: "boss" | "delegate" | "agent";
  owner: string; // wallace | amelia | hire | <agent key>
  ownerLabel?: string;
  why?: string;
  done?: string; // 完成标准
  due?: string;
  kr?: string;
  priority?: number; // 1 最重要
};
export type StrategyDecision = { id: string; question: string; kind?: string; options: string[]; recommend?: number; why?: string };
export type StrategyKpi = { key: string; label: string; value?: number | null; target?: number | null; unit?: string; note?: string };
export type Strategy = {
  week: string; // 2026-W47
  weekStart?: string; // 2026-11-16
  generatedAt?: string;
  north?: { revenueNow?: number; goal?: number; goalYear?: number; yearTarget?: number; path?: { year: number; target: number }[] };
  theme: string;
  diagnosis?: string[];
  okrs?: StrategyOKR[];
  tasks?: StrategyTask[];
  decisions?: StrategyDecision[];
  kpis?: StrategyKpi[];
  review?: { week?: string; score?: number | null; wins?: string[]; misses?: string[]; lesson?: string } | null;
  dataGaps?: string[];
  idea?: string;
};
export type Answer = { done?: boolean; choice?: number; note?: string; at: string };
export type Answers = Record<string, Answer>;

export const STRATEGY_AGENT = "strategy";
export const LANE_LABEL: Record<StrategyTask["lane"], string> = { boss: "老板亲自做", delegate: "找人做", agent: "AI 员工做" };

async function getJson<T>(key: string): Promise<T | null> {
  const row = await db.setting.findUnique({ where: { key } }).catch(() => null);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}
async function putJson(key: string, v: unknown) {
  const value = JSON.stringify(v);
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export const loadStrategy = () => getJson<Strategy>("strategy:current");
export const loadAnswers = async () => (await getJson<Answers>("strategy:answers")) || {};

export async function loadHistory(n = 6): Promise<Strategy[]> {
  const rows = await db.setting.findMany({ where: { key: { startsWith: "strategy:week:" } }, orderBy: { key: "desc" }, take: n });
  return rows.flatMap((r) => {
    try {
      return [JSON.parse(r.value) as Strategy];
    } catch {
      return [];
    }
  });
}

const str = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const arr = <T>(v: unknown, max = 30): T[] => (Array.isArray(v) ? (v.slice(0, max) as T[]) : []);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** 清洗 Kai 交上来的 JSON：字段限长、补 id，坏的直接丢掉，免得页面炸。 */
export function cleanStrategy(raw: any): Strategy | string {
  if (!raw || typeof raw !== "object") return "strategy required";
  const week = str(raw.week, 10);
  if (!/^\d{4}-W\d{2}$/.test(week)) return "week must look like 2026-W47";
  const theme = str(raw.theme, 200);
  if (!theme) return "theme required";
  const lanes = ["boss", "delegate", "agent"];
  return {
    week,
    weekStart: str(raw.weekStart, 10) || undefined,
    generatedAt: new Date().toISOString(),
    north: raw.north && typeof raw.north === "object"
      ? {
          revenueNow: num(raw.north.revenueNow) ?? undefined,
          goal: num(raw.north.goal) ?? undefined,
          goalYear: num(raw.north.goalYear) ?? undefined,
          yearTarget: num(raw.north.yearTarget) ?? undefined,
          path: arr<any>(raw.north.path, 10).map((p) => ({ year: num(p?.year) || 0, target: num(p?.target) || 0 })).filter((p) => p.year),
        }
      : undefined,
    theme,
    diagnosis: arr<unknown>(raw.diagnosis, 8).map((d) => str(d, 300)).filter(Boolean),
    okrs: arr<any>(raw.okrs, 5).map((o, i) => ({
      id: str(o?.id, 20) || `O${i + 1}`,
      objective: str(o?.objective, 200),
      krs: arr<any>(o?.krs, 5).map((k, j) => ({ id: str(k?.id, 20) || `O${i + 1}KR${j + 1}`, text: str(k?.text, 200), current: num(k?.current), target: num(k?.target), unit: str(k?.unit, 10) })).filter((k) => k.text),
    })).filter((o) => o.objective),
    tasks: arr<any>(raw.tasks, 40).map((t, i) => ({
      id: str(t?.id, 20) || `T${i + 1}`,
      title: str(t?.title, 180),
      lane: (lanes.includes(t?.lane) ? t.lane : "boss") as StrategyTask["lane"],
      owner: str(t?.owner, 40).toLowerCase() || "wallace",
      ownerLabel: str(t?.ownerLabel, 40) || undefined,
      why: str(t?.why, 300) || undefined,
      done: str(t?.done, 200) || undefined,
      due: str(t?.due, 20) || undefined,
      kr: str(t?.kr, 20) || undefined,
      priority: num(t?.priority) ?? undefined,
    })).filter((t) => t.title),
    decisions: arr<any>(raw.decisions, 6).map((d, i) => ({
      id: str(d?.id, 20) || `D${i + 1}`,
      question: str(d?.question, 200),
      kind: str(d?.kind, 10) || undefined,
      options: arr<unknown>(d?.options, 4).map((o) => str(o, 80)).filter(Boolean),
      recommend: num(d?.recommend) ?? undefined,
      why: str(d?.why, 300) || undefined,
    })).filter((d) => d.question && d.options.length >= 2),
    kpis: arr<any>(raw.kpis, 12).map((k) => ({ key: str(k?.key, 40), label: str(k?.label, 40), value: num(k?.value), target: num(k?.target), unit: str(k?.unit, 10), note: str(k?.note, 120) || undefined })).filter((k) => k.label),
    review: raw.review && typeof raw.review === "object"
      ? { week: str(raw.review.week, 10), score: num(raw.review.score), wins: arr<unknown>(raw.review.wins, 6).map((w) => str(w, 200)).filter(Boolean), misses: arr<unknown>(raw.review.misses, 6).map((w) => str(w, 200)).filter(Boolean), lesson: str(raw.review.lesson, 300) }
      : null,
    dataGaps: arr<unknown>(raw.dataGaps, 6).map((d) => str(d, 200)).filter(Boolean),
    idea: str(raw.idea, 300) || undefined,
  };
}

/** 存下本周战略、存档，并把分给 AI 员工的任务挂到他们的看板上（标题前加 🎯，同名就更新）。 */
export async function saveStrategy(s: Strategy) {
  await putJson("strategy:current", s);
  await putJson(`strategy:week:${s.week}`, s);
  const agents = await db.agent.findMany({ select: { id: true, key: true } });
  const byKey = new Map(agents.map((a) => [a.key, a.id]));
  const carded: string[] = [];
  for (const t of s.tasks || []) {
    const agentId = t.lane === "agent" ? byKey.get(t.owner) : undefined;
    if (!agentId) continue;
    const title = `🎯 ${t.title}`.slice(0, 200);
    const note = [t.why, t.done && `完成标准：${t.done}`, t.due && `截止 ${t.due}`, `战略 ${s.week}`].filter(Boolean).join("｜").slice(0, 500);
    const existing = await db.agentTask.findFirst({ where: { agentId, title } });
    if (existing) await db.agentTask.update({ where: { id: existing.id }, data: { note } });
    else await db.agentTask.create({ data: { agentId, title, status: "todo", note } });
    carded.push(t.owner);
  }
  const me = byKey.get(STRATEGY_AGENT);
  if (me) {
    await db.agentRun.create({
      data: { agentId: me, task: `定 ${s.week} 战略`, status: "ok", summary: s.theme.slice(0, 500), outputCount: (s.tasks || []).length, finishedAt: new Date() },
    });
    // Kai 自己的看板：本周主线
    const title = `${s.week} 战略：${s.theme}`.slice(0, 200);
    await db.agentTask.updateMany({ where: { agentId: me, status: "doing", NOT: { title } }, data: { status: "done" } });
    const mine = await db.agentTask.findFirst({ where: { agentId: me, title } });
    if (!mine) await db.agentTask.create({ data: { agentId: me, title, status: "doing", note: "每周日复盘上周、定下周；下周日自动换新" } });
  }
  return { carded };
}

export async function saveAnswer(week: string, id: string, a: Omit<Answer, "at">) {
  const all = await loadAnswers();
  const k = `${week}:${id}`;
  all[k] = { ...all[k], ...a, at: new Date().toISOString() };
  // 只留最近 300 条
  const keys = Object.keys(all).sort((x, y) => (all[y].at || "").localeCompare(all[x].at || ""));
  for (const old of keys.slice(300)) delete all[old];
  await putJson("strategy:answers", all);
}
