import Link from "next/link";
import { loadOffice, loadPromo, PROMO_FIELDS, STATUS_LABEL } from "@/lib/office";
import { moodFor } from "./_components/Avatar";
import CountUp from "./_components/CountUp";
import Sparkbars from "./_components/Sparkbars";
import NeedsYou from "./_components/NeedsYou";
import PixelOffice, { type PixelRoom } from "./_components/PixelOffice";

export const dynamic = "force-dynamic";

/**
 * WWFS办公室 · 前台（2026-11-03 Wallace：「把现在每一个正在工作的部门做一套管理系统」
 * 「每个人负责一个单独的工作空间」「注重视觉呈现，要直观」「放上卡通动画」）。
 * 一张办公室平面图：每个部门一间房，每个人一个工位，小人的动作就是状态。点工位进去。
 * 原来的「每日仪表盘」挪到 /dashboard。
 */

const PROMO_COLOR: Record<string, string> = { posts: "#3b82f6", impressions: "#6366f1", followers: "#ec4899", dms: "#f59e0b", leads: "#7c3aed", signups: "#10b981" };


export default async function Lobby() {
  const [{ agents, departments, handoffCount, needs }, promo] = await Promise.all([loadOffice(), loadPromo()]);
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

  // 像素办公室：每个部门一间房
  const rooms: PixelRoom[] = departments.map((d) => ({
    name: d.name,
    people: [
      ...d.agents.map((a) => {
        const now = a.tasks.find((t) => t.status === "doing") || a.tasks.find((t) => t.status === "blocked") || a.tasks.find((t) => t.status === "todo");
        const mood = moodFor(a.needs ? "error" : a.status, a.happy);
        return {
          key: a.key,
          name: a.name,
          title: a.title || "AI 员工",
          tags: a.tags,
          href: `/office/${a.key}`,
          mood,
          statusLabel: a.needs ? `有 ${a.needs} 件事找你` : STATUS_LABEL[a.status].label,
          task: now?.title || null,
          unread: a.unread,
          shared: !!a.host?.includes("共用"),
        };
      }),
      ...d.staff.map((s) => ({
        key: s.name.toLowerCase(),
        name: s.name,
        title: s.role || "员工",
        tags: null,
        href: s.workspaceUrl || "/team",
        external: !!s.workspaceUrl,
        mood: "work" as const,
        statusLabel: "工作空间：CRM",
        task: null,
        unread: 0,
      })),
      ...d.openSeats.map((s) => ({
        key: "seat-" + s.title,
        name: s.title,
        title: s.note,
        tags: null,
        href: "/board",
        mood: "sleep" as const,
        statusLabel: "招聘中",
        task: null,
        unread: 0,
        seat: true,
      })),
    ],
  }));

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
          <p className="mt-1 text-sm text-stone-600">点一位同事进他的工位：打开他的工作空间、交代事情、看他手上的事。</p>
        </div>
        <div className="flex gap-3 text-xs text-stone-500">
          <span>⌨️ 敲键盘 = 在岗</span>
          <span>💤 = 未上岗</span>
          <span>❗ = 找你 / 出错</span>
          <span>💬 = 有留言没看</span>
        </div>
      </div>

      <div className="rise">
        <PixelOffice rooms={rooms} />
      </div>

      <NeedsYou needs={needs} />

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

    </div>
  );
}
