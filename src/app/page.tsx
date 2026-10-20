import Link from "next/link";
import { db } from "@/lib/db";
import { syncAutoKpi } from "@/lib/autoKpi";
import { loadTeam, hoursAgo, WINDOW_DAYS, type AgentRow, type AgentStatus } from "@/lib/team";
import { currentPeriod, previousPeriod, formatValue, computeDelta, formatDeltaPct, type Format } from "@/lib/metrics";

export const dynamic = "force-dynamic";

/**
 * 每日仪表盘（2026-10-16 Wallace：「一个看板就能完成……主要检查员工和 AI agent 的 input」
 * 「每个部门的仪表盘汇总」）。
 *
 * 读法跟大公司高管看报表一样：第一块「今天要处理」只列异常，没红就不用往下看；
 * 下面按部门给明细（人 → 交了什么），再往下是 AI agent 花名册和系统更新。
 * 月度 KPI 每个部门只摘一行，点进去是原来的「月度经营总览」。
 */

function ago(iso: string | null): string {
  const h = hoursAgo(iso);
  if (h === null) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}分钟前`;
  if (h < 48) return `${Math.round(h)}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

const STATUS: Record<AgentStatus, { label: string; cls: string }> = {
  ok: { label: "正常", cls: "bg-emerald-50 text-emerald-700" },
  late: { label: "超时", cls: "bg-red-50 text-red-700" },
  error: { label: "出错", cls: "bg-red-50 text-red-700" },
  never: { label: "未打卡", cls: "bg-amber-50 text-amber-700" },
  paused: { label: "已停用", cls: "bg-stone-100 text-stone-500" },
};

function SourcePill({ name, src }: { name: string; src: { ok: boolean; error?: string } }) {
  return (
    <span
      className={"badge " + (src.ok ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500")}
      title={src.ok ? "已连接" : (src as any).error}
    >
      {src.ok ? "●" : "○"} {name}
    </span>
  );
}

function Td({ children, warn }: { children: React.ReactNode; warn?: "red" | "amber" | false }) {
  const cls = warn === "red" ? "text-red-700 font-semibold" : warn === "amber" ? "text-amber-700 font-medium" : "";
  return <td className={"px-3 py-2 whitespace-nowrap " + cls}>{children}</td>;
}

function BigNumber({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className="card px-4 py-4">
      <div className={"text-3xl md:text-4xl font-bold tabular-nums " + (warn ? "text-red-600" : "text-stone-900")}>{value}</div>
      <div className="text-sm text-stone-500 mt-1">{label}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm md:text-base font-semibold tabular-nums whitespace-nowrap">{value}</div>
      <div className="text-[11px] text-stone-500">{label}</div>
    </div>
  );
}

function dot(flags: { level: "red" | "amber" }[]) {
  if (flags.some((f) => f.level === "red")) return "bg-red-500";
  if (flags.length) return "bg-amber-400";
  return "bg-emerald-500";
}

type Warn = "red" | "amber" | false;
function Stat({ label, value, warn }: { label: string; value: React.ReactNode; warn?: Warn }) {
  const cls = warn === "red" ? "text-red-700" : warn === "amber" ? "text-amber-700" : "text-stone-900";
  return (
    <div className="rounded-lg bg-stone-50 px-2 py-1.5">
      <div className={"text-base font-semibold " + cls}>{value}</div>
      <div className="text-[11px] text-stone-500">{label}</div>
    </div>
  );
}

function AgentCard({ a }: { a: AgentRow }) {
  const s = STATUS[a.status];
  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">🤖 {a.name}</div>
          <div className="text-xs text-stone-500">
            {a.host || "—"} · {a.schedule || `每 ${a.everyHours} 小时`}
          </div>
        </div>
        <span className={"badge " + s.cls}>{s.label}</span>
      </div>
      {a.duty && <p className="text-sm text-stone-700">{a.duty}</p>}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-lg font-semibold">{a.runs7d}</div>
          <div className="text-xs text-stone-500">运行次数</div>
        </div>
        <div>
          <div className={"text-lg font-semibold " + (a.errors7d ? "text-red-700" : "")}>{a.errors7d}</div>
          <div className="text-xs text-stone-500">出错</div>
        </div>
        <div>
          <div className="text-lg font-semibold">{a.outputs7d}</div>
          <div className="text-xs text-stone-500">产出</div>
        </div>
      </div>
      <div className="text-xs text-stone-500">
        最后活动：{ago(a.lastSeenAt)}
        {a.lastSeenVia ? `（${a.lastSeenVia}）` : ""}
      </div>
      {a.recent.length > 0 && (
        <ul className="text-xs space-y-1 border-t border-stone-100 pt-2">
          {a.recent.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className={r.status === "error" ? "text-red-600" : "text-emerald-600"}>{r.status === "error" ? "✕" : "✓"}</span>
              <span className="text-stone-500 shrink-0">{ago(r.at)}</span>
              <span className="truncate">
                {r.task || "运行"}
                {r.outputCount != null ? ` · ${r.outputCount} 个` : ""}
                {r.summary ? ` · ${r.summary}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function monthlyStrip(deptKey: string) {
  const period = currentPeriod();
  const prev = previousPeriod(period);
  const dept = await db.department.findUnique({
    where: { key: deptKey },
    include: { metrics: { orderBy: { order: "asc" }, include: { values: { where: { period: { in: [period, prev] } } } } } },
  });
  // 本月还没录入的指标不占位置（全空就整行不显示），免得一排「—」
  const filled = dept?.metrics.filter((m) => m.values.some((v) => v.period === period)) || [];
  if (filled.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {filled.map((m) => {
        const c = m.values.find((v) => v.period === period)?.value ?? null;
        const p = m.values.find((v) => v.period === prev)?.value ?? null;
        const d = computeDelta(c, p, m.betterWhen);
        const tone = d.tone === "good" ? "delta-good" : d.tone === "bad" ? "delta-bad" : "delta-flat";
        return (
          <Link key={m.id} href="/kpi" className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm hover:border-brand-300">
            <span className="text-stone-500">{m.name}</span>{" "}
            <span className="font-semibold">{formatValue(c, m.format as Format, m.unit)}</span>
            {d.abs !== null && <span className={"badge ml-1 " + tone}>{formatDeltaPct(d)}</span>}
          </Link>
        );
      })}
    </div>
  );
}

export default async function Daily() {
  const [{ staffRows, agentRows, unlisted, alerts, crm, mkt, merged }] = await Promise.all([
    loadTeam(),
    syncAutoKpi([currentPeriod(), previousPeriod(currentPeriod())]),
  ]);
  const [salesKpi, mktKpi, opsKpi] = await Promise.all([monthlyStrip("sales"), monthlyStrip("marketing"), monthlyStrip("operations")]);
  const today = new Intl.DateTimeFormat("zh-CN", { timeZone: "America/Toronto", month: "long", day: "numeric", weekday: "long" }).format(new Date());
  const m = mkt.ok ? mkt.data.agents : null;
  const crmRows = staffRows.map((s) => s.crm).filter((c): c is NonNullable<typeof c> => !!c);
  const totals = {
    closes: crmRows.reduce((n, c) => n + c.closes, 0),
    followUpsToday: crmRows.reduce((n, c) => n + c.followUpsToday, 0),
    overdue: crmRows.reduce((n, c) => n + c.overdue, 0),
  };
  const agentsOk = agentRows.filter((a) => a.active && a.status === "ok").length;
  // 同一个人的红色提醒合并成一行，首页每人最多一行
  const redAlerts: { who: string; text: string }[] = [];
  for (const a of alerts.filter((x) => x.level === "red")) {
    const row = redAlerts.find((r) => r.who === a.who);
    if (row) row.text += " · " + a.text;
    else redAlerts.push({ who: a.who, text: a.text });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h1 className="text-xl md:text-2xl font-semibold">{today}</h1>
        <div className="flex gap-1.5 flex-wrap">
          <SourcePill name="CRM" src={crm} />
          <SourcePill name="Marketing" src={mkt} />
        </div>
      </div>

      {/* 1. 四个大数字：每天只看这里 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BigNumber label="本周成交" value={crm.ok ? totals.closes : "—"} />
        <BigNumber label="今日跟进" value={crm.ok ? totals.followUpsToday : "—"} warn={crm.ok && totals.followUpsToday === 0} />
        <BigNumber label="逾期未跟进客户" value={crm.ok ? totals.overdue : "—"} warn={totals.overdue > 0} />
        <BigNumber label="AI Agent 正常" value={`${agentsOk}/${agentRows.filter((a) => a.active).length}`} warn={agentsOk < agentRows.filter((a) => a.active).length} />
      </div>

      {/* 2. 要你处理的事：只有红色；黄色收在明细里 */}
      {redAlerts.length === 0 ? (
        <div className="card p-4 text-emerald-700 font-medium">✓ 没有需要你马上处理的事</div>
      ) : (
        <div className="card divide-y divide-stone-100">
          {redAlerts.map((a, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-red-500" />
              <span className="font-semibold w-20 md:w-28 shrink-0">{a.who}</span>
              <span className="text-stone-800">{a.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* 3. 每人每 agent 一行 */}
      <div className="card divide-y divide-stone-100">
        {staffRows.map((s) => {
          const goal = s.weeklyFilmMinutes;
          const mins = s.mkt?.filmMinutes || 0;
          return (
            <div key={s.id} className="px-4 py-3 flex items-center gap-3">
              <span className={"w-2.5 h-2.5 rounded-full shrink-0 " + (s.crm || s.mkt ? dot(s.flags) : "bg-stone-300")} />
              <span className="font-semibold w-20 shrink-0">{s.name}</span>
              <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                <Mini label="今日跟进" value={s.crm ? s.crm.followUpsToday : "—"} />
                <Mini label="逾期" value={s.crm ? s.crm.overdue : "—"} />
                <Mini label="本周拍摄" value={goal ? `${mins}/${goal}` : mins} />
              </div>
            </div>
          );
        })}
        {agentRows.filter((a) => a.active).map((a) => (
          <div key={a.id} className="px-4 py-3 flex items-center gap-3">
            <span className={"w-2.5 h-2.5 rounded-full shrink-0 " + (a.status === "ok" ? "bg-emerald-500" : a.status === "never" ? "bg-amber-400" : "bg-red-500")} />
            <span className="font-semibold w-20 shrink-0">🤖 {a.name}</span>
            <div className="flex-1 grid grid-cols-3 gap-2 text-center">
              <Mini label="状态" value={STATUS[a.status].label} />
              <Mini label="最后运行" value={ago(a.lastSeenAt)} />
              <Mini label="本周产出" value={a.outputs7d} />
            </div>
          </div>
        ))}
      </div>

      <details className="group">
        <summary className="cursor-pointer select-none text-sm text-brand-700 py-2">查看明细（全部提醒、各部门、Agent 记录、系统更新）</summary>
        <div className="space-y-8 pt-4">
      {/* 全部提醒 */}
      {alerts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">全部提醒</h2>
          <div className="card divide-y divide-stone-100">
            {alerts.map((a, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className={"w-2 h-2 rounded-full shrink-0 " + (a.level === "red" ? "bg-red-500" : "bg-amber-400")} />
                <span className="font-medium w-20 md:w-28 shrink-0">{a.who}</span>
                <span className="text-stone-700">{a.text}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. 销售部 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">💼 销售部 · 跟进与成交</h2>
        {salesKpi}
        <div className="md:hidden space-y-2">
          {staffRows.map((s) => {
            const c = s.crm;
            const h = hoursAgo(c?.lastFollowUpAt || null);
            return (
              <div key={s.id} className="card p-3 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-xs text-stone-500">{s.role}</span>
                </div>
                {c ? (
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <Stat label="今日跟进" value={c.followUpsToday} warn={c.followUpsToday === 0 && "amber"} />
                    <Stat label="最近跟进" value={ago(c.lastFollowUpAt)} warn={(h === null || h > 48) && "red"} />
                    <Stat label="逾期客户" value={c.overdue} warn={c.overdue >= 5 ? "red" : c.overdue > 0 && "amber"} />
                    <Stat label={`${WINDOW_DAYS}天跟进`} value={c.followUps} />
                    <Stat label="业绩日报" value={`${c.activityDays}/${WINDOW_DAYS}`} warn={c.activityDays < 3 && "amber"} />
                    <Stat label="工作日记" value={`${c.journalDays}/${WINDOW_DAYS}`} />
                    <Stat label="刷题" value={c.trainingAttempts} />
                    <Stat label="刷题均分" value={c.trainingAvgScore ?? "—"} />
                    <Stat label="成交" value={c.closes} />
                  </div>
                ) : (
                  <p className="text-sm text-stone-400">{crm.ok ? "CRM 里没找到这个人" : "CRM 未连接"}</p>
                )}
              </div>
            );
          })}
        </div>
        <div className="card overflow-x-auto hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-xs">
              <tr>
                {["员工", "今日跟进", `${WINDOW_DAYS}天跟进`, "最近跟进", "逾期客户", "业绩日报", "工作日记", "刷题 / 均分", "成交"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {staffRows.map((s) => {
                const c = s.crm;
                const h = hoursAgo(c?.lastFollowUpAt || null);
                return (
                  <tr key={s.id}>
                    <Td>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-stone-500">{s.role}</div>
                    </Td>
                    {c ? (
                      <>
                        <Td warn={c.followUpsToday === 0 && "amber"}>{c.followUpsToday}</Td>
                        <Td>{c.followUps}</Td>
                        <Td warn={(h === null || h > 48) && "red"}>{ago(c.lastFollowUpAt)}</Td>
                        <Td warn={c.overdue >= 5 ? "red" : c.overdue > 0 && "amber"}>{c.overdue}</Td>
                        <Td warn={c.activityDays < 3 && "amber"}>{c.activityDays}/{WINDOW_DAYS} 天</Td>
                        <Td>{c.journalDays}/{WINDOW_DAYS} 天</Td>
                        <Td>
                          {c.trainingAttempts} 次{c.trainingAvgScore != null ? ` / ${c.trainingAvgScore} 分` : ""}
                        </Td>
                        <Td>{c.closes}</Td>
                      </>
                    ) : (
                      <td colSpan={8} className="px-3 py-2 text-stone-400">
                        {crm.ok ? "CRM 里没找到，去「人员与 Agent 名单」改匹配名" : "CRM 未连接"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {unlisted.length > 0 && (
          <p className="text-xs text-stone-500">
            CRM 里还有在干活但没登记的销售：{unlisted.map((u) => u.name).join("、")}。
            <Link href="/team" className="text-brand-700 hover:underline ml-1">去登记 →</Link>
          </p>
        )}
      </section>

      {/* 3. 内容部（市场 + 运营） */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">🎬 内容部 · 拍摄与发布</h2>
        {mktKpi}
        {opsKpi}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="md:hidden space-y-2">
            {staffRows.map((s) => {
              const p = s.mkt;
              const mins = p?.filmMinutes || 0;
              const goal = s.weeklyFilmMinutes;
              return (
                <div key={s.id} className="card p-3 space-y-2">
                  <div className="font-semibold">{s.name}</div>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <Stat label={goal ? `拍摄分钟/目标${goal}` : "拍摄分钟"} value={mins} warn={goal > 0 && mins < goal && (mins < goal / 2 ? "red" : "amber")} />
                    <Stat label="拍摄天数" value={p?.filmDays ?? 0} />
                    <Stat label="最近拍摄" value={ago(p?.lastFilmAt || null)} />
                  </div>
                </div>
              );
            })}
            {!mkt.ok && <p className="text-xs text-stone-400">Marketing 未连接</p>}
          </div>
          <div className="card overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-stone-500 text-xs">
                <tr>
                  {["出镜", "拍摄分钟 / 周目标", "拍摄天数", "场次", "最近拍摄", "灵感"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {staffRows.map((s) => {
                  const p = s.mkt;
                  const mins = p?.filmMinutes || 0;
                  const goal = s.weeklyFilmMinutes;
                  return (
                    <tr key={s.id}>
                      <Td>{s.name}</Td>
                      <Td warn={goal > 0 && mins < goal && (mins < goal / 2 ? "red" : "amber")}>
                        {mins}
                        {goal ? ` / ${goal}` : ""}
                      </Td>
                      <Td>{p?.filmDays ?? 0}</Td>
                      <Td>{p?.filmSessions ?? 0}</Td>
                      <Td>{ago(p?.lastFilmAt || null)}</Td>
                      <Td>{p?.inspirations ?? 0}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!mkt.ok && <p className="px-3 py-2 text-xs text-stone-400">Marketing 未连接</p>}
          </div>
          <div className="card p-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="label">自动发布</div>
              <div className="text-xl font-semibold">{m?.autoPublish.published ?? "—"}</div>
              <div className={"text-xs " + ((m?.autoPublish.failed || 0) > 0 ? "text-red-700" : "text-stone-500")}>
                失败 {m?.autoPublish.failed ?? 0} · 排队 {(m?.autoPublish.queued || 0) + (m?.autoPublish.uploading || 0) + (m?.autoPublish.processing || 0)}
              </div>
            </div>
            <div>
              <div className="label">一键派稿</div>
              <div className="text-xl font-semibold">{m?.distribute.variants ?? "—"}</div>
              <div className="text-xs text-stone-500">{m?.distribute.jobs ?? 0} 批 · 最近 {ago(m?.distribute.lastAt || null)}</div>
            </div>
            <div>
              <div className="label">数据分析</div>
              <div className="text-xl font-semibold">{m?.analysis.runs ?? "—"}</div>
              <div className="text-xs text-stone-500">失败 {m?.analysis.failed ?? 0} · 最近 {ago(m?.analysis.lastAt || null)}</div>
            </div>
            <div>
              <div className="label">粉丝同步</div>
              <div className={"text-xl font-semibold " + (m?.followerSync?.status === "failed" ? "text-red-700" : "")}>
                {m?.followerSync ? (m.followerSync.status === "done" ? "完成" : m.followerSync.status === "failed" ? "失败" : "运行中") : "—"}
              </div>
              <div className="text-xs text-stone-500">{ago(m?.followerSync?.startedAt || null)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. AI agent */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">🤖 AI Agent · 有没有按时跑</h2>
          <Link href="/team" className="text-sm text-brand-700 hover:underline">加 agent / 改排程 →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {agentRows.map((a) => (
            <AgentCard key={a.id} a={a} />
          ))}
        </div>
        {m && m.questionsNeedingHuman > 0 && (
          <p className="text-sm text-amber-700">Agent 收件箱里有 {m.questionsNeedingHuman} 个问题等人回答（Marketing → Agent 问答）。</p>
        )}
      </section>

      {/* 5. 系统更新 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">🛠 系统更新 · 最近 {WINDOW_DAYS} 天上线</h2>
        {merged.ok ? (
          merged.data.length === 0 ? (
            <div className="card p-4 text-sm text-stone-500">这几天没有新上线。</div>
          ) : (
            <div className="card divide-y divide-stone-100 text-sm max-h-80 overflow-y-auto">
              {merged.data.map((p) => (
                <a key={p.url} href={p.url} target="_blank" rel="noreferrer" className="px-4 py-2 flex gap-3 hover:bg-stone-50">
                  <span className="badge bg-stone-100 text-stone-600 shrink-0">{p.label}</span>
                  <span className="flex-1 truncate">{p.title}</span>
                  <span className="text-stone-400 shrink-0">{ago(p.mergedAt)}</span>
                </a>
              ))}
            </div>
          )
        ) : (
          <div className="card p-4 text-sm text-stone-400">GitHub 未连接（{merged.error}）</div>
        )}
      </section>

        <p className="text-xs text-stone-400">
          只统计工作产出（跟进、日报、刷题、拍摄、agent 运行），不采集位置、屏幕或键盘。安省员工满 25 人时须有书面电子监控政策（ESA Part XI.1），
          届时把这页列的数据项写进政策告知员工即可。
        </p>
        </div>
      </details>

    </div>
  );
}
