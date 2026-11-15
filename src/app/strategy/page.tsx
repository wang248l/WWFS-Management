import Link from "next/link";
import { db } from "@/lib/db";
import { LANE_LABEL, loadAnswers, loadHistory, loadStrategy, STRATEGY_AGENT, type Strategy, type StrategyTask } from "@/lib/strategy";
import { PixelPortrait } from "../_components/PixelOffice";
import { DecisionButtons, DoneBox } from "./StrategyActions";

export const dynamic = "force-dynamic";

const money = (n?: number | null) => (n === null || n === undefined ? "—" : n >= 1_000_000 ? `$${+(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`);
const fmt = (n?: number | null, unit?: string) => (n === null || n === undefined ? "—" : unit === "$" ? money(n) : `${n.toLocaleString()}${unit || ""}`);

const LANE_STYLE: Record<StrategyTask["lane"], { icon: string; ring: string; head: string }> = {
  boss: { icon: "👔", ring: "border-amber-300", head: "bg-amber-50 text-amber-900" },
  delegate: { icon: "🤝", ring: "border-violet-300", head: "bg-violet-50 text-violet-900" },
  agent: { icon: "🤖", ring: "border-sky-300", head: "bg-sky-50 text-sky-900" },
};
const KIND_TONE: Record<string, string> = { 合规: "bg-red-50 text-red-700", 花钱: "bg-amber-50 text-amber-800", 对外发送: "bg-violet-50 text-violet-700", 招人: "bg-emerald-50 text-emerald-700" };

function weekRange(s: Strategy) {
  if (!s.weekStart) return "";
  const d = new Date(s.weekStart + "T12:00:00Z");
  const e = new Date(d.getTime() + 6 * 86400_000);
  const f = (x: Date) => `${x.getUTCMonth() + 1}/${x.getUTCDate()}`;
  return `${f(d)}–${f(e)}`;
}

function Bar({ value, target, tone = "bg-brand-600" }: { value?: number | null; target?: number | null; tone?: string }) {
  const pct = value != null && target ? Math.max(0, Math.min(100, (value / target) * 100)) : 0;
  return (
    <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * 战略作战室（2026-11-15 Wallace：「AI 定战略，我只负责执行或者找人执行」）。
 * Kai 每周日晚上定好：本周主线 → 要你拍板的事 → 三条泳道的任务（你做 / 找人做 / AI 员工做）→ OKR → 数字。
 * 你在这里只做两件事：勾「做完了」、点拍板选项。Kai 下周复盘时读到。
 */
export default async function StrategyPage() {
  const [s, answers, history, kai, agents] = await Promise.all([
    loadStrategy(),
    loadAnswers(),
    loadHistory(8),
    db.agent.findUnique({ where: { key: STRATEGY_AGENT }, include: { runs: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    db.agent.findMany({ include: { tasks: { where: { title: { startsWith: "🎯 " } } } } }),
  ]);

  if (!s) {
    return (
      <div className="space-y-5">
        <Link href="/" className="text-sm text-brand-700 hover:underline">← 回办公室</Link>
        <div className="card p-8 text-center">
          <div className="flex justify-center"><PixelPortrait who={STRATEGY_AGENT} name="Kai" mood="work" size={96} /></div>
          <h1 className="text-2xl font-semibold mt-3">🎯 战略作战室</h1>
          <p className="text-stone-600 mt-2">AI 战略官 Kai 还没交第一份周战略。每周日晚上自动出，出了这里就会亮。</p>
        </div>
      </div>
    );
  }

  const name = new Map(agents.map((a) => [a.key, a.name]));
  const cardOf = (t: StrategyTask) => agents.find((a) => a.key === t.owner)?.tasks.find((c) => c.title === `🎯 ${t.title}`.slice(0, 200));
  const tasks = [...(s.tasks || [])].sort((a, b) => (a.priority || 9) - (b.priority || 9));
  const lanes: StrategyTask["lane"][] = ["boss", "delegate", "agent"];
  const isDone = (t: StrategyTask) => (t.lane === "agent" ? cardOf(t)?.status === "done" : !!answers[`${s.week}:${t.id}`]?.done);
  const doneN = tasks.filter(isDone).length;
  const openDecisions = (s.decisions || []).filter((d) => answers[`${s.week}:${d.id}`]?.choice === undefined).length;
  const n = s.north || {};
  const northPct = n.revenueNow && n.goal ? Math.min(100, (n.revenueNow / n.goal) * 100) : 0;
  const ran = kai?.runs[0]?.createdAt || (s.generatedAt ? new Date(s.generatedAt) : null);

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-brand-700 hover:underline">← 回办公室</Link>

      {/* 本周主线 */}
      <section className="rise card overflow-hidden">
        <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-brand-800 text-white p-5 flex flex-wrap items-center gap-4">
          <div className="rounded-xl bg-white/10 p-1"><PixelPortrait who={STRATEGY_AGENT} name="Kai" mood="work" size={76} /></div>
          <div className="flex-1 min-w-[14rem]">
            <div className="text-xs uppercase tracking-wider text-stone-300">AI 战略官 Kai · {s.week} {weekRange(s)}</div>
            <h1 className="text-2xl md:text-3xl font-bold mt-1 leading-snug text-white">{s.theme}</h1>
            <div className="text-xs text-stone-300 mt-2">
              {ran ? `定于 ${ran.toLocaleString("zh-CN", { timeZone: "America/Edmonton", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""} · 每周日晚上复盘上周、定下周
            </div>
          </div>
          <div className="flex gap-3 text-center">
            <div className="rounded-xl bg-white/10 px-4 py-2"><div className="text-2xl font-bold">{doneN}/{tasks.length}</div><div className="text-xs text-stone-300">任务完成</div></div>
            <div className={`rounded-xl px-4 py-2 ${openDecisions ? "bg-red-500/80" : "bg-white/10"}`}><div className="text-2xl font-bold">{openDecisions}</div><div className="text-xs text-stone-100">等你拍板</div></div>
          </div>
        </div>
        {(n.goal || n.revenueNow) && (
          <div className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="text-sm text-stone-500">北极星：年收入</div>
                <div className="text-xl font-bold">{money(n.revenueNow)} <span className="text-stone-400 font-normal">→</span> {money(n.goal)} <span className="text-sm font-normal text-stone-500">（{n.goalYear} 年）</span></div>
              </div>
              {n.yearTarget ? <div className="text-sm">今年目标 <b>{money(n.yearTarget)}</b></div> : null}
            </div>
            <div className="mt-3 h-4 rounded-full bg-stone-100 overflow-hidden relative">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-brand-600" style={{ width: `${Math.max(2, northPct)}%` }} />
            </div>
            {!!n.path?.length && (
              <div className="mt-3 flex flex-wrap gap-2">
                {n.path.map((p) => (
                  <span key={p.year} className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs"><b>{p.year}</b> {money(p.target)}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 要你拍板 */}
      {!!s.decisions?.length && (
        <section className="rise">
          <h2 className="font-semibold text-lg mb-2">🔴 要你拍板（只有你能决定：合规 / 花钱 / 对外发送 / 招人）</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {s.decisions.map((d) => {
              const a = answers[`${s.week}:${d.id}`];
              return (
                <div key={d.id} className={`card p-4 border-2 ${a?.choice !== undefined ? "border-emerald-200" : "border-red-200"}`}>
                  <div className="flex items-center gap-2">
                    {d.kind && <span className={`badge ${KIND_TONE[d.kind] || "bg-stone-100 text-stone-700"}`}>{d.kind}</span>}
                    {a?.choice !== undefined && <span className="badge bg-emerald-50 text-emerald-700">已拍板</span>}
                  </div>
                  <div className="font-semibold mt-2">{d.question}</div>
                  {d.why && <div className="text-sm text-stone-600 mt-1">Kai 建议：{d.why}</div>}
                  <DecisionButtons week={s.week} id={d.id} options={d.options} recommend={d.recommend} chosen={a?.choice} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 三条泳道 */}
      <section className="rise">
        <h2 className="font-semibold text-lg mb-2">📋 本周任务</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {lanes.map((lane) => {
            const list = tasks.filter((t) => t.lane === lane);
            const st = LANE_STYLE[lane];
            return (
              <div key={lane} className={`card border-2 ${st.ring} overflow-hidden`}>
                <div className={`px-4 py-2.5 font-semibold flex items-center justify-between ${st.head}`}>
                  <span>{st.icon} {LANE_LABEL[lane]}</span>
                  <span className="text-xs font-normal">{list.filter(isDone).length}/{list.length}</span>
                </div>
                <ul className="divide-y divide-stone-100">
                  {!list.length && <li className="p-4 text-sm text-stone-400">这周没有</li>}
                  {list.map((t) => {
                    const card = lane === "agent" ? cardOf(t) : null;
                    const done = isDone(t);
                    return (
                      <li key={t.id} className={`p-3.5 ${done ? "bg-emerald-50/50" : ""}`}>
                        <div className="flex gap-2.5">
                          {lane === "agent" ? (
                            <span className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs ${done ? "bg-emerald-500 border-emerald-500 text-white" : "border-stone-300"}`}>{done ? "✓" : ""}</span>
                          ) : (
                            <DoneBox week={s.week} id={t.id} done={done} />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className={`font-medium ${done ? "line-through text-stone-400" : ""}`}>
                              {t.priority === 1 && <span className="text-red-600 mr-1">★</span>}
                              {t.title}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1 text-xs">
                              <span className="badge bg-stone-100 text-stone-700">{t.ownerLabel || name.get(t.owner) || (t.owner === "wallace" ? "你" : t.owner === "hire" ? "待招的人" : t.owner)}</span>
                              {t.due && <span className="badge bg-white border border-stone-200 text-stone-600">截止 {t.due}</span>}
                              {t.kr && <span className="badge bg-brand-50 text-brand-700">{t.kr}</span>}
                              {card && <span className="badge bg-sky-50 text-sky-700">看板：{({ todo: "待办", doing: "进行中", blocked: "卡住", handoff: "移交", done: "完成" } as Record<string, string>)[card.status] || card.status}</span>}
                            </div>
                            {t.done && <div className="text-xs text-stone-600 mt-1.5">✅ 完成标准：{t.done}</div>}
                            {t.why && <div className="text-xs text-stone-500 mt-0.5">为什么：{t.why}</div>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* OKR + 数字 */}
      <div className="grid gap-3 lg:grid-cols-2">
        {!!s.okrs?.length && (
          <section className="rise card p-4">
            <h2 className="font-semibold">🎯 本周 OKR</h2>
            <div className="mt-3 space-y-4">
              {s.okrs.map((o) => (
                <div key={o.id}>
                  <div className="font-medium"><span className="text-brand-700">{o.id}</span> {o.objective}</div>
                  <ul className="mt-2 space-y-2">
                    {o.krs.map((k) => (
                      <li key={k.id} className="text-sm">
                        <div className="flex justify-between gap-2"><span><span className="text-stone-400">{k.id}</span> {k.text}</span><span className="shrink-0 font-semibold">{fmt(k.current, k.unit)} / {fmt(k.target, k.unit)}</span></div>
                        <div className="mt-1"><Bar value={k.current} target={k.target} /></div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}
        {!!s.kpis?.length && (
          <section className="rise card p-4">
            <h2 className="font-semibold">📊 记分牌</h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {s.kpis.map((k) => (
                <div key={k.key || k.label} className="rounded-xl border border-stone-200 p-3">
                  <div className="text-xs text-stone-500">{k.label}</div>
                  <div className="text-xl font-bold mt-0.5">{fmt(k.value, k.unit)}{k.target != null && <span className="text-sm font-normal text-stone-400"> / {fmt(k.target, k.unit)}</span>}</div>
                  {k.target != null && <div className="mt-1.5"><Bar value={k.value} target={k.target} tone={k.value != null && k.value >= k.target ? "bg-emerald-500" : "bg-amber-500"} /></div>}
                  {k.note && <div className="text-xs text-stone-500 mt-1">{k.note}</div>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 诊断 + 复盘 */}
      <div className="grid gap-3 lg:grid-cols-2">
        {!!s.diagnosis?.length && (
          <section className="rise card p-4">
            <h2 className="font-semibold">🩺 Kai 看到的（为什么这周这么定）</h2>
            <ul className="mt-2 space-y-1.5 text-sm list-disc pl-5">{s.diagnosis.map((d) => <li key={d}>{d}</li>)}</ul>
            {!!s.dataGaps?.length && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">
                <div className="font-medium text-amber-900">⚠ 缺数据（Kai 只能估）</div>
                <ul className="list-disc pl-5 mt-1 text-amber-900">{s.dataGaps.map((d) => <li key={d}>{d}</li>)}</ul>
              </div>
            )}
          </section>
        )}
        <section className="rise card p-4">
          <h2 className="font-semibold">🔁 上周复盘{s.review?.week ? ` · ${s.review.week}` : ""}</h2>
          {s.review ? (
            <div className="mt-2 text-sm space-y-2">
              {s.review.score != null && <div className="text-3xl font-bold">{s.review.score}<span className="text-base font-normal text-stone-400"> / 100</span></div>}
              {!!s.review.wins?.length && <div><b className="text-emerald-700">做成了</b><ul className="list-disc pl-5">{s.review.wins.map((w) => <li key={w}>{w}</li>)}</ul></div>}
              {!!s.review.misses?.length && <div><b className="text-red-700">没做成</b><ul className="list-disc pl-5">{s.review.misses.map((w) => <li key={w}>{w}</li>)}</ul></div>}
              {s.review.lesson && <div className="rounded-lg bg-stone-50 p-2.5">💡 {s.review.lesson}</div>}
            </div>
          ) : (
            <p className="text-sm text-stone-500 mt-2">第一周，还没有可复盘的。下周日 Kai 会按这周的勾选和数字打分。</p>
          )}
          {s.idea && <div className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">✨ 改进建议：{s.idea}</div>}
        </section>
      </div>

      {history.length > 1 && (
        <section className="rise card p-4">
          <h2 className="font-semibold">🗂 历史战略</h2>
          <ul className="mt-2 divide-y divide-stone-100 text-sm">
            {history.map((h) => (
              <li key={h.week} className="py-2 flex gap-3">
                <span className="font-mono text-stone-500 shrink-0">{h.week}</span>
                <span className="flex-1">{h.theme}</span>
                {h.review?.score != null && <span className="text-stone-500">上周 {h.review.score} 分</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
