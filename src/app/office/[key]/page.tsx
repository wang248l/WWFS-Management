import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { agentStatus, loadPromo, PROMO_AGENTS, PROMO_FIELDS, STATUS_LABEL } from "@/lib/office";
import TaskBoard from "../../_components/TaskBoard";
import NeedsYou from "../../_components/NeedsYou";
import ProjectLink from "./ProjectLink";
import { loadSkills } from "@/lib/skills";
import { loadAiLog } from "@/lib/aiLog";
import { moodFor } from "../../_components/Avatar";
import { PixelPortrait } from "../../_components/PixelOffice";
import CountUp from "../../_components/CountUp";
import Sparkbars from "../../_components/Sparkbars";

export const dynamic = "force-dynamic";

function when(d: Date) {
  return d.toLocaleString("zh-CN", { timeZone: "America/Vancouver", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * 一个人的工位（只读反馈，2026-11-03 Wallace：「management 不是我发布指令的地方……我要的是反馈，
 * 发布指令我都会在 Claude 里面做」）：在不在干活、定时任务和周期、上次结果、产出、卡在哪。
 */
export default async function Desk({ params }: { params: { key: string } }) {
  const a = await db.agent.findUnique({
    where: { key: params.key },
    include: {
      runs: { where: { createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } }, orderBy: { createdAt: "desc" } },
      tasks: { orderBy: [{ order: "asc" }, { updatedAt: "desc" }] },
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
    },
  });
  if (!a) notFound();
  const needs = a.messages
    .filter((m) => m.fromRole === "agent" && (m.kind === "blocker" || m.kind === "meeting") && !m.resolvedAt)
    .map((m) => ({ ...m, agent: { key: a.key, name: a.name, avatar: a.avatar } }));
  const ai = (await loadAiLog()).byAgent[a.key];
  const aiStuck = ai?.stuck || [];
  const aiLast = ai?.lastAt ? { status: ai.lastStatus === "fail" ? "error" : "ok", createdAt: new Date(ai.lastAt), finishedAt: new Date(ai.lastAt) } : null;
  const runForStatus = aiLast && (!a.runs[0] || aiLast.createdAt > (a.runs[0].finishedAt || a.runs[0].createdAt)) ? aiLast : a.runs[0];
  const status = needs.length || aiStuck.length ? "error" : agentStatus(a, runForStatus);
  const st = needs.length || aiStuck.length ? { ...STATUS_LABEL.error, label: "卡住了" } : STATUS_LABEL[status];
  const happy = a.tasks.some((t) => (t.status === "done" || t.status === "handoff") && Date.now() - t.updatedAt.getTime() < 86400_000);
  const promo = PROMO_AGENTS.includes(a.key) ? (await loadPromo([a.key]))[a.key] : null;
  const me = { key: a.key, name: a.name, avatar: a.avatar };
  const last = runForStatus ? runForStatus.finishedAt || runForStatus.createdAt : null;
  const next = last ? new Date(last.getTime() + a.everyHours * 3600_000) : null;
  const overdue = next ? Date.now() > next.getTime() + a.graceHours * 3600_000 : false;
  const errors7d = a.runs.filter((r) => r.status === "error").length;
  const outputs7d = a.runs.reduce((n, r) => n + (r.outputCount || 0), 0);
  const reports = a.messages.filter((m) => m.fromRole === "agent").slice(-20).reverse();
  const every = a.everyHours >= 24 && a.everyHours % 24 === 0 ? `每 ${a.everyHours / 24} 天` : `每 ${a.everyHours} 小时`;
  const skills = await loadSkills(a.skills);
  const lastTrained = skills.items.map((i) => i.date).filter(Boolean).sort().pop() || null;
  const daysSince = lastTrained ? Math.floor((Date.now() - Date.parse(lastTrained)) / 86400_000) : null;

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-brand-700 hover:underline">
        ← 回办公室
      </Link>
      <div className="card room-floor p-5 flex flex-wrap items-center gap-4">
        <PixelPortrait who={a.key} name={a.name} mood={moodFor(status, happy)} size={84} />
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

      <NeedsYou needs={needs} link={false} />

      {ai?.findings && (
        <section className="rise card p-4">
          <h2 className="font-semibold">🔍 Ivy 最近 24 小时查出的问题（{ai.findings.length}）</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            不信台账，不登录去公开页看到底发没发出去（YouTube、小红书）；再从结果倒推卡在哪一环。上次检查：{ai.lastMsg || "—"}
          </p>
          {!ai.findings.length && <p className="text-sm text-emerald-700 mt-2">✅ 没有问题。</p>}
          <ul className="mt-2 space-y-2 text-sm">
            {ai.findings.map((e) => (
              <li key={e.id} className="rounded-lg bg-red-50 px-3 py-2">
                <div className="flex gap-2 text-xs text-stone-500">
                  {e.ip !== "-" && <span>{e.ip}</span>}
                  {e.platform !== "-" && <span>{e.platform}</span>}
                  <span className="ml-auto">{when(new Date(e.ts))}</span>
                </div>
                <div className="font-medium text-red-900">{e.msg}</div>
                {e.why && <div className="text-xs text-stone-600 mt-0.5">原因：{e.why}</div>}
                {e.fix && <div className="text-xs text-stone-600">查：{e.fix}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {aiStuck.length > 0 && (
        <section className="rise rounded-2xl border-2 border-red-200 bg-red-50/60 p-4">
          <h2 className="font-semibold">❗ 卡住了 · 来自 AI 工作日志（{aiStuck.length} 件）</h2>
          <p className="text-xs text-stone-500 mt-0.5">同一件事最近一次是失败、24 小时内还没成功过。后面成功了会自动消失。</p>
          <ul className="mt-2 space-y-2 text-sm">
            {aiStuck.map((e) => (
              <li key={e.id} className="card p-3">
                <div className="flex gap-2 text-xs text-stone-500">
                  <span className="badge bg-red-100 text-red-700">{e.task}</span>
                  {e.ip !== "-" && <span>{e.ip}</span>}
                  {e.platform !== "-" && <span>{e.platform}</span>}
                  <span className="ml-auto">{when(new Date(e.ts))}</span>
                </div>
                <div className="mt-1 font-medium">{e.msg}</div>
                {(e.where || e.why || e.fix) && (
                  <div className="text-xs text-stone-600 mt-1 space-y-0.5">
                    {e.where && <div>哪里：{e.where}</div>}
                    {e.why && <div>原因：{e.why}</div>}
                    {e.fix && <div>处理：{e.fix}</div>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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

      <section className="card p-4">
        <h2 className="font-semibold">⏰ 定时任务</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
          {[
            { label: "排程", value: a.schedule || "未填" },
            { label: "周期", value: every + "一次" },
            { label: "上次运行", value: last ? when(last) : "还没打过卡", warn: !last },
            { label: "下次应在", value: next ? when(next) : "—", warn: overdue },
            ai
              ? { label: "近 24 小时（AI 工作日志）", value: `${ai.count24h} 件 · 失败 ${ai.fail24h}`, warn: aiStuck.length > 0 }
              : { label: "近 7 天", value: `${a.runs.length} 次 · 出错 ${errors7d} · 产出 ${outputs7d}`, warn: errors7d > 0 },
          ].map((c) => (
            <div key={c.label} className="rounded-lg bg-stone-50 px-3 py-2">
              <div className={"text-sm font-semibold " + (c.warn ? "text-red-600" : "")}>{c.value}</div>
              <div className="text-[11px] text-stone-500">{c.label}</div>
            </div>
          ))}
        </div>
        <div className="text-xs text-stone-500 mt-2">跑在：{a.host || "未填"}{overdue && <span className="text-red-600 font-medium"> · 超时没跑</span>}</div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="font-semibold mb-2">🗂 运行记录 · 近 7 天</h2>
          {!a.runs.length && <p className="text-sm text-stone-400">这 7 天没打过卡。</p>}
          <ul className="divide-y divide-stone-100 text-sm max-h-96 overflow-y-auto">
            {a.runs.map((r) => (
              <li key={r.id} className="py-2 flex gap-3">
                <span className={"badge shrink-0 " + (r.status === "error" ? "bg-red-50 text-red-700" : r.status === "running" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700")}>
                  {r.status === "error" ? "出错" : r.status === "running" ? "运行中" : "完成"}
                </span>
                <div className="min-w-0">
                  <div className="truncate">{r.task || "—"}</div>
                  {r.summary && <div className="text-xs text-stone-500 truncate">{r.summary}</div>}
                </div>
                <span className="ml-auto text-xs text-stone-400 shrink-0 text-right">
                  {when(r.finishedAt || r.createdAt)}
                  {r.outputCount !== null && <div className="text-stone-600 font-medium">产出 {r.outputCount}</div>}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-4">
          <h2 className="font-semibold mb-2">📮 {a.name} 的汇报</h2>
          {!reports.length && <p className="text-sm text-stone-400">还没有汇报。</p>}
          <ul className="space-y-2 text-sm max-h-96 overflow-y-auto">
            {reports.map((m) => (
              <li
                key={m.id}
                className={
                  "rounded-lg px-3 py-2 whitespace-pre-wrap " +
                  (m.kind === "blocker" ? "bg-red-50 text-red-900" : m.kind === "meeting" ? "bg-amber-50 text-amber-900" : m.kind === "progress" ? "bg-emerald-50 text-emerald-900" : "bg-stone-50")
                }
              >
                <div className="text-[11px] font-semibold mb-0.5 flex gap-2">
                  <span>{m.kind === "blocker" ? "🚧 卡住了" : m.kind === "meeting" ? "📅 请求开会" : m.kind === "progress" ? "✅ 进度" : "💬 汇报"}</span>
                  {(m.kind === "blocker" || m.kind === "meeting") && <span>{m.urgent ? "紧急" : "明天开会"}{m.resolvedAt ? " · 已处理" : ""}</span>}
                  <span className="ml-auto font-normal text-stone-400">{when(m.createdAt)}</span>
                </div>
                {m.text}
              </li>
            ))}
          </ul>
        </section>
      </div>


      <section className="card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold">🎓 培训 · 技能</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              培训 = 在 {a.name} 的 project 里用 Claude 改他的 skill。改完提交，这里自动显示新版本。
            </p>
          </div>
          <ProjectLink agentKey={a.key} name={a.name} url={a.projectUrl} />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="rounded-lg bg-stone-50 px-3 py-2">
            <div className="text-2xl font-bold tabular-nums">{skills.items.length}</div>
            <div className="text-[11px] text-stone-500">技能</div>
          </div>
          <div className="rounded-lg bg-stone-50 px-3 py-2">
            <div className={"text-2xl font-bold " + (daysSince !== null && daysSince > 14 ? "text-amber-600" : "")}>
              {daysSince === null ? "—" : daysSince === 0 ? "今天" : `${daysSince} 天前`}
            </div>
            <div className="text-[11px] text-stone-500">上次培训</div>
          </div>
          <div className="rounded-lg bg-stone-50 px-3 py-2">
            <div className="text-2xl font-bold">{a.projectUrl ? "✅" : "⏳"}</div>
            <div className="text-[11px] text-stone-500">培训 project</div>
          </div>
        </div>
        {skills.items.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {skills.items.map((k) => (
              <li key={k.folder}>
                <a href={k.url} target="_blank" rel="noreferrer" className="desk-card block rounded-lg border border-stone-200 bg-white px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium truncate">📘 {k.folder}</span>
                    {k.sha && <span className="ml-auto badge bg-brand-50 text-brand-700 font-mono">v·{k.sha}</span>}
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5 truncate">
                    {k.date ? `${k.date.slice(0, 10)} · ${k.message} · 共改过 ${k.commits}${k.commits === 30 ? "+" : ""} 次` : skills.connected ? "仓库里还没有这个文件夹" : "版本信息要配 GITHUB_TOKEN"}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-400 mt-3">还没指定技能文件夹。</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">📋 {a.name} 的看板</h2>
        <TaskBoard tasks={a.tasks.map((t) => ({ ...t, updatedAt: t.updatedAt.toISOString(), agent: me }))} agents={[me]} fixedAgent={a.key} readOnly />
      </section>
    </div>
  );
}
