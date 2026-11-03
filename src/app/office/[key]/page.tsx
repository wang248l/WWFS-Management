import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { agentStatus, loadPromo, PROMO_AGENTS, PROMO_FIELDS, STATUS_LABEL } from "@/lib/office";
import TaskBoard from "../../_components/TaskBoard";
import Chat from "./Chat";
import Avatar, { moodFor } from "../../_components/Avatar";
import CountUp from "../../_components/CountUp";
import Sparkbars from "../../_components/Sparkbars";

export const dynamic = "force-dynamic";

function when(d: Date) {
  return d.toLocaleString("zh-CN", { timeZone: "America/Vancouver", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** 一个人的工位：工作空间入口 + 对话 + 他的看板 + 最近打卡。 */
export default async function Desk({ params }: { params: { key: string } }) {
  const a = await db.agent.findUnique({
    where: { key: params.key },
    include: {
      runs: { orderBy: { createdAt: "desc" }, take: 8 },
      tasks: { orderBy: [{ order: "asc" }, { updatedAt: "desc" }] },
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
    },
  });
  if (!a) notFound();
  const status = agentStatus(a, a.runs[0]);
  const st = STATUS_LABEL[status];
  const happy = a.tasks.some((t) => (t.status === "done" || t.status === "handoff") && Date.now() - t.updatedAt.getTime() < 86400_000);
  const promo = PROMO_AGENTS.includes(a.key) ? (await loadPromo([a.key]))[a.key] : null;
  const me = { key: a.key, name: a.name, avatar: a.avatar };

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-brand-700 hover:underline">
        ← 回办公室
      </Link>
      <div className="card room-floor p-5 flex flex-wrap items-center gap-4">
        <Avatar who={a.key} mood={moodFor(status, happy)} size={96} />
        <div className="flex-1 min-w-[12rem]">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold">{a.name}</h1>
            <span className={"badge " + st.cls}>{st.label}</span>
            {a.department && <span className="badge bg-stone-100 text-stone-600">{a.department}</span>}
          </div>
          <div className="text-sm text-stone-600 mt-1">{a.title}</div>
          {a.tags && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {a.tags.split(/[,，]/).filter(Boolean).map((t) => (
                <span key={t} className="rounded-full bg-white border border-stone-200 shadow-sm text-xs px-2.5 py-0.5 font-medium">
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="text-xs text-stone-500 mt-1">
            {a.duty} · {a.schedule || "排程未填"} · {a.host || "机器未填"}
          </div>
        </div>
        {a.workspaceUrl ? (
          <a href={a.workspaceUrl} target="_blank" rel="noreferrer" className="btn-primary px-5 py-3 text-base shadow-lg hover:-translate-y-0.5 hover:shadow-xl">
            打开工作空间：{a.workspaceName || a.workspaceUrl} ↗
          </a>
        ) : (
          <span className="badge bg-amber-50 text-amber-700 px-3 py-1.5">工作空间待建</span>
        )}
      </div>

      {promo && (
        <section className="card p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">📈 线上宣发 · 近 7 天</h2>
            <span className="text-xs text-stone-500">{promo.days ? `已报 ${promo.days} 天` : "还没报过数（值班时 POST /api/agents/metrics）"}</span>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
            {PROMO_FIELDS.map((f) => (
              <div key={f.key} className="rounded-lg bg-stone-50 px-3 py-2 flex items-end justify-between gap-2">
                <div>
                  <div className={"text-2xl font-bold tabular-nums " + (f.key === "leads" ? "text-violet-700" : "")}>
                    {promo.totals[f.key] === null ? "—" : <CountUp value={promo.totals[f.key] as number} />}
                  </div>
                  <div className="text-[11px] text-stone-500">{f.label}</div>
                </div>
                <Sparkbars values={promo.series[f.key]} color={f.key === "leads" ? "#7c3aed" : "#6366f1"} />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Chat
          agentKey={a.key}
          agentName={a.name}
          avatar={a.avatar || "🤖"}
          initial={a.messages.map((m) => ({ ...m, readAt: m.readAt?.toISOString() || null, createdAt: m.createdAt.toISOString() }))}
        />
        <section className="card p-4">
          <h2 className="font-semibold mb-2">最近打卡</h2>
          {!a.runs.length && <p className="text-sm text-stone-400">还没打过卡。</p>}
          <ul className="divide-y divide-stone-100 text-sm">
            {a.runs.map((r) => (
              <li key={r.id} className="py-2 flex gap-3">
                <span className={"badge shrink-0 " + (r.status === "error" ? "bg-red-50 text-red-700" : r.status === "running" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700")}>
                  {r.status === "error" ? "出错" : r.status === "running" ? "运行中" : "完成"}
                </span>
                <div className="min-w-0">
                  <div className="truncate">{r.task || "—"}</div>
                  {r.summary && <div className="text-xs text-stone-500 truncate">{r.summary}</div>}
                </div>
                <span className="ml-auto text-xs text-stone-400 shrink-0">{when(r.finishedAt || r.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">📋 {a.name} 的看板</h2>
        <TaskBoard tasks={a.tasks.map((t) => ({ ...t, updatedAt: t.updatedAt.toISOString(), agent: me }))} agents={[me]} fixedAgent={a.key} />
      </section>
    </div>
  );
}
