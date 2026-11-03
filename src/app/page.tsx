import Link from "next/link";
import { loadOffice, loadPromo, PROMO_FIELDS, STATUS_LABEL } from "@/lib/office";
import DeskScene, { SharedDeskScene } from "./_components/DeskScene";
import { moodFor } from "./_components/Avatar";
import CountUp from "./_components/CountUp";
import Sparkbars from "./_components/Sparkbars";

export const dynamic = "force-dynamic";

/**
 * WWFS办公室 · 前台（2026-11-03 Wallace：「把现在每一个正在工作的部门做一套管理系统」
 * 「每个人负责一个单独的工作空间」「注重视觉呈现，要直观」「放上卡通动画」）。
 * 一张办公室平面图：每个部门一间房，每个人一个工位，小人的动作就是状态。点工位进去。
 * 原来的「每日仪表盘」挪到 /dashboard。
 */

const ROOM_TINT: Record<string, string> = {
  社媒运营部: "from-sky-50", 运营部: "from-blue-50", 市场部: "from-amber-50", 增员部: "from-teal-50", 内容部: "from-purple-50", 出镜顾问: "from-pink-50", 销售部: "from-violet-50",
};
const PROMO_COLOR: Record<string, string> = { posts: "#3b82f6", impressions: "#6366f1", followers: "#ec4899", dms: "#f59e0b", leads: "#7c3aed", signups: "#10b981" };

function Tags({ tags }: { tags: string | null }) {
  if (!tags) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.split(/[,，]/).filter(Boolean).map((t) => (
        <span key={t} className="rounded-md bg-stone-100 text-stone-700 text-[11px] px-1.5 py-0.5">
          {t}
        </span>
      ))}
    </div>
  );
}

export default async function Lobby() {
  const [{ agents, departments, handoffCount }, promo] = await Promise.all([loadOffice(), loadPromo()]);
  const active = agents.filter((a) => a.active);
  const onDuty = active.filter((a) => a.status === "ok").length;
  const doing = agents.reduce((n, a) => n + a.tasks.filter((t) => t.status === "doing").length, 0);
  const blocked = agents.reduce((n, a) => n + a.tasks.filter((t) => t.status === "blocked").length, 0);
  const unread = agents.reduce((n, a) => n + a.unread, 0);

  // 宣发合计（Mark + Leo），每天一根柱子
  const promoKeys = Object.keys(promo);
  const promoTotals = PROMO_FIELDS.map((f) => {
    const series = [...Array(7)].map((_, i) => {
      const vs = promoKeys.map((k) => promo[k].series[f.key][i]).filter((v) => v !== null) as number[];
      return vs.length ? vs.reduce((a, b) => a + b, 0) : null;
    });
    const has = series.some((v) => v !== null);
    return { ...f, total: has ? series.reduce((a: number, b) => a + (b || 0), 0) : null, series };
  });

  const tiles = [
    { label: "在岗", value: onDuty, suffix: `/${active.length}`, icon: "🟢", tone: "text-emerald-600" },
    { label: "进行中", value: doing, icon: "⚙️", tone: "text-blue-600" },
    { label: "卡住", value: blocked, icon: "🚧", tone: blocked ? "text-red-600" : "text-stone-400" },
    { label: "移交销售", value: handoffCount, icon: "🤝", tone: handoffCount ? "text-violet-600" : "text-stone-400" },
    { label: "未读留言", value: unread, icon: "💬", tone: unread ? "text-amber-600" : "text-stone-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="rise flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">🏢 WWFS办公室</h1>
          <p className="mt-1 text-sm text-stone-600">点一个工位进去：打开他的工作空间、跟他说话、看他手上的事。</p>
        </div>
        <div className="flex gap-3 text-xs text-stone-500">
          <span>🙂 在岗干活</span>
          <span>😴 未上岗</span>
          <span>😰 超时 / 出错</span>
          <span>🤩 有好消息</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {tiles.map((s, i) => (
          <Link key={s.label} href="/board" className="desk-card rise card px-4 py-4" style={{ animationDelay: `${i * 70}ms` }}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-500">{s.label}</span>
              <span className="text-lg">{s.icon}</span>
            </div>
            <div className={"text-3xl md:text-4xl font-extrabold tabular-nums mt-1 " + s.tone}>
              <CountUp value={s.value} />
              {s.suffix && <span className="text-lg text-stone-400 font-semibold">{s.suffix}</span>}
            </div>
          </Link>
        ))}
      </div>

      <section className="rise card p-4" style={{ animationDelay: "350ms" }}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">📈 线上宣发 · 近 7 天（Mark + Leo）</h2>
          <span className="text-xs text-stone-500">只算线上，留资的客户移交销售</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
          {promoTotals.map((f) => (
            <div key={f.key} className="rounded-xl bg-stone-50 px-3 py-3 flex items-end justify-between gap-2">
              <div>
                <div className="text-2xl font-bold tabular-nums" style={{ color: f.total === null ? "#a8a29e" : PROMO_COLOR[f.key] }}>
                  {f.total === null ? "—" : <CountUp value={f.total} />}
                </div>
                <div className="text-[11px] text-stone-500">{f.label}</div>
              </div>
              <Sparkbars values={f.series} color={PROMO_COLOR[f.key]} />
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {departments.map((d, di) => (
          <section
            key={d.name}
            className="rise room-floor rounded-2xl border-2 border-stone-200 overflow-hidden relative"
            style={{ animationDelay: `${450 + di * 90}ms` }}
          >
            <div className={"bg-gradient-to-b to-transparent " + (ROOM_TINT[d.name] || "from-stone-50")}>
              <div className="flex items-center justify-between px-4 pt-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/90 shadow-sm border border-stone-200 px-3 py-1">
                  <span className="text-lg">{d.icon}</span>
                  <span className="font-semibold">{d.name}</span>
                  <span className="text-xs text-stone-400">{d.agents.length + d.staff.length} 人</span>
                </div>
                <span className="text-xl" aria-hidden>
                  🪴
                </span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {(() => {
                  const shared = d.agents.filter((a) => a.host?.includes("共用"));
                  if (shared.length < 2) return null;
                  return (
                    <div className="desk-card sm:col-span-2 rounded-xl bg-white/95 border border-stone-200 p-3">
                      <SharedDeskScene people={shared.map((a) => ({ who: a.key, mood: moodFor(a.status, a.happy) }))} />
                      <div className="text-center text-[11px] text-stone-500 -mt-1 mb-2">🖥️ 共用一台 Mac mini</div>
                      <div className="grid grid-cols-2 gap-3">
                        {shared.map((a) => {
                          const st = STATUS_LABEL[a.status];
                          const now = a.tasks.find((t) => t.status === "doing") || a.tasks.find((t) => t.status === "blocked") || a.tasks.find((t) => t.status === "todo");
                          return (
                            <Link key={a.id} href={`/office/${a.key}`} className="relative rounded-lg hover:bg-stone-50 p-2 text-center">
                              <div className="font-bold text-base">
                                {a.name}{" "}
                                <span className={"badge align-middle " + st.cls}>
                                  <span className={"pulse-dot w-1.5 h-1.5 rounded-full mr-1 " + st.dot} />
                                  {st.label}
                                </span>
                              </div>
                              <div className="text-[11px] text-stone-500">{a.title}</div>
                              <div className="flex justify-center"><Tags tags={a.tags} /></div>
                              <div className="text-xs mt-1.5 line-clamp-2 text-stone-700">{now ? now.title : <span className="text-stone-400">手上没事</span>}</div>
                              <div className="text-xs text-brand-700 mt-1">进工位 →</div>
                              {a.unread > 0 && (
                                <span className="absolute top-0 right-0 rounded-full bg-red-500 text-white text-xs font-bold w-6 h-6 grid place-items-center shadow animate-bounce">{a.unread}</span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                {d.agents.filter((a) => !(a.host?.includes("共用") && d.agents.filter((x) => x.host?.includes("共用")).length >= 2)).map((a) => {
                  const st = STATUS_LABEL[a.status];
                  const now = a.tasks.find((t) => t.status === "doing") || a.tasks.find((t) => t.status === "blocked") || a.tasks.find((t) => t.status === "todo");
                  return (
                    <Link key={a.id} href={`/office/${a.key}`} className="desk-card relative rounded-xl bg-white/95 border border-stone-200 p-3 flex gap-2 items-end">
                      <DeskScene who={a.key} mood={moodFor(a.status, a.happy)} />
                      <div className="min-w-0 flex-1 pb-1">
                        <div className="font-bold text-base truncate">{a.name}</div>
                        <div className="text-[11px] text-stone-500 truncate">{a.title || "AI 员工"}</div>
                        <Tags tags={a.tags} />
                        <span className={"badge mt-1 " + st.cls}>
                          <span className={"pulse-dot w-1.5 h-1.5 rounded-full mr-1 " + st.dot} />
                          {st.label}
                        </span>
                        <div className="text-xs mt-1.5 line-clamp-2 text-stone-700">{now ? now.title : <span className="text-stone-400">手上没事</span>}</div>
                      </div>
                      {a.unread > 0 && (
                        <span className="absolute -top-2 -right-2 rounded-full bg-red-500 text-white text-xs font-bold w-6 h-6 grid place-items-center shadow animate-bounce">
                          {a.unread}
                        </span>
                      )}
                    </Link>
                  );
                })}
                {d.staff.map((s) => (
                  <a key={s.id} href={s.workspaceUrl || "#"} target="_blank" rel="noreferrer" className="desk-card rounded-xl bg-white/95 border border-stone-200 p-3 flex gap-2 items-end">
                    <DeskScene who={s.name} mood="work" human />
                    <div className="min-w-0 pb-1">
                      <div className="font-bold">{s.name}</div>
                      <div className="text-[11px] text-stone-500">{s.role || "员工"}</div>
                      <div className="text-xs text-brand-700 mt-1.5">{s.workspaceUrl ? "工作空间：CRM ↗" : "工作空间待建"}</div>
                    </div>
                  </a>
                ))}
                {d.openSeats.map((s) => (
                  <Link key={s.title} href="/board" className="desk-card rounded-xl border-2 border-dashed border-violet-300 bg-white/60 p-3 flex gap-2 items-end">
                    <div className="w-[112px] h-[104px] shrink-0 grid place-items-center text-5xl opacity-70">🪑</div>
                    <div className="pb-1">
                      <div className="font-bold">
                        {s.title} <span className="badge bg-amber-100 text-amber-700 ml-1">招聘中</span>
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5">{s.note}</div>
                      <div className="text-xs text-violet-700 mt-1.5 font-medium">待接手客户 {handoffCount} 个 →</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
