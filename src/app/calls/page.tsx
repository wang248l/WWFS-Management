import Link from "next/link";
import { fetchInsights, fmtDateTime } from "@/lib/calls";
import { FunnelStrip, FlagList, CompareGrid, ReportBlock, NotConnected } from "./_ui";

export const dynamic = "force-dynamic";

/**
 * 通话分析（2026-10-17 Wallace：电话录音变逐字稿 → 分析为什么转化率不够 → 定期跑 →
 * 结果进 management，能看 Ishan 每一通电话的分析）。
 *
 * 读法：最上面四个数字；然后是「哪一环节高得 / 低得不正常」；再往下每人一张卡：
 * 漏斗、来了 vs 放鸽子两组对比、Claude 的放鸽子原因报告摘要，点进去看每一通电话。
 * 数据每次打开从 CRM 现拉；CRM 每天凌晨 2 点（多伦多）自动跑一次分析。
 */

const DAY_OPTIONS = [30, 90, 180];

function Big({ label, value, warn, sub }: { label: string; value: React.ReactNode; warn?: boolean; sub?: string }) {
  return (
    <div className="card px-4 py-4">
      <div className={"text-3xl md:text-4xl font-bold tabular-nums " + (warn ? "text-red-600" : "text-stone-900")}>{value}</div>
      <div className="text-sm text-stone-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-stone-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default async function CallsPage({ searchParams }: { searchParams: { days?: string } }) {
  const days = DAY_OPTIONS.includes(Number(searchParams.days)) ? Number(searchParams.days) : 90;
  const src = await fetchInsights(days);

  const header = (
    <div className="flex items-baseline justify-between gap-3 flex-wrap">
      <h1 className="text-xl md:text-2xl font-semibold">📞 通话分析</h1>
      <div className="flex gap-1">
        {DAY_OPTIONS.map((d) => (
          <Link
            key={d}
            href={d === 90 ? "/calls" : `/calls?days=${d}`}
            className={"rounded-md px-2.5 py-1 text-sm " + (d === days ? "bg-stone-900 text-white" : "bg-white border border-stone-200 text-stone-700")}
          >
            {d}天
          </Link>
        ))}
      </div>
    </div>
  );
  if (!src.ok) {
    return (
      <div className="space-y-5">
        {header}
        <NotConnected error={src.error} />
      </div>
    );
  }
  const d = src.data;
  const f = d.team.funnel;
  const noShows = Math.max(0, f.booked - f.handedOff - f.bookedPending - f.zoom1);
  const showRate = d.team.conv.phoneToZoom1;

  // 有漏斗的人 + 只有通话没有新客资的人，都要有一张卡
  const cards = [
    ...d.advisors.map((a) => ({ key: a.userId, userId: a.userId, name: a.name, adv: a, calls: a.calls })),
    ...d.people
      .filter((p) => !d.advisors.some((a) => a.userId === p.userId))
      .map((p) => ({ key: p.userId || p.name, userId: p.userId, name: p.name, adv: null, calls: p })),
  ];

  return (
    <div className="space-y-5">
      {header}
      <p className="text-xs text-stone-500 -mt-3">
        最近 {d.days} 天进来的客资 · 分析最后一次跑在 {d.lastRunAt ? fmtDateTime(d.lastRunAt) : "（还没跑过）"} · 每天凌晨 2 点自动更新
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Big label="第一次会议出席率" value={`${showRate}%`} warn={showRate < 70} sub="行业一般 70% 以上" />
        <Big label="约到了没来" value={noShows} warn={noShows > 0} sub={f.handedOff ? `另有 ${f.handedOff} 个约给别人开，不算` : undefined} />
        <Big label="通话平均分" value={d.team.stats.avgScore ?? "—"} warn={(d.team.stats.avgScore ?? 100) < 60} />
        <Big label="分析了的通话" value={`${d.team.stats.analyzed}/${d.team.stats.calls}`} warn={d.team.stats.failed > 0} sub={d.team.stats.zoomMeetings ? `含 Zoom 会议 ${d.team.stats.zoomMeetings} 场` : "电话录音"} />
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">哪一环节不正常</h2>
        <FlagList flags={d.flags} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">每个人</h2>
        {cards.length === 0 && <div className="card p-4 text-sm text-stone-500">这段时间没有客资也没有通话录音</div>}
        {cards.map((c) => {
          const flags = d.flags.filter((x) => x.userId === c.userId);
          return (
            <div key={c.key} className="card p-4 space-y-4">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold">{c.name}</span>
                  {c.calls && <span className="text-sm text-stone-500">{c.calls.stats.calls} 通录音</span>}
                </div>
                {c.userId && (
                  <Link href={`/calls/${c.userId}`} className="text-sm text-brand-700 hover:underline">
                    看每一通电话 →
                  </Link>
                )}
              </div>
              {c.adv && <FunnelStrip funnel={c.adv.funnel} conv={c.adv.conv} flags={flags} />}
              {c.adv && c.adv.funnel.handedOff > 0 && (
                <p className="text-xs text-violet-700">
                  约给别人开的会 {c.adv.funnel.handedOff} 个（来了 {c.adv.funnel.handedOffAttended} 个），不算进出席率
                </p>
              )}
              {c.calls ? (
                <div className="grid md:grid-cols-2 gap-4">
                  <CompareGrid s={c.calls.stats} />
                  <ReportBlock r={c.calls.report} compact />
                </div>
              ) : (
                <p className="text-sm text-stone-400">这段时间 CRM 里没有他的通话录音。打电话时在客户页点「开始录制」才会有。</p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
