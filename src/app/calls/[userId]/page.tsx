import Link from "next/link";
import { fetchInsights, OUTCOME, PHASE, type Outcome } from "@/lib/calls";
import { FunnelStrip, FlagList, CompareGrid, ReportBlock, CallLine, NotConnected } from "../_ui";

export const dynamic = "force-dynamic";

// 一个人的通话分析：放鸽子原因报告全文 + 每一通电话（可按结果筛），点进去看逐字稿。
const FILTERS: (Outcome | "all")[] = ["all", "no_show", "came", "not_booked", "pending", "handed_off"];

export default async function PersonCalls({
  params,
  searchParams,
}: {
  params: { userId: string };
  searchParams: { o?: string; days?: string };
}) {
  const days = [30, 90, 180].includes(Number(searchParams.days)) ? Number(searchParams.days) : 90;
  const src = await fetchInsights(days, params.userId);
  const back = (
    <Link href="/calls" className="text-sm text-brand-700 hover:underline">
      ← 通话分析
    </Link>
  );
  if (!src.ok) {
    return (
      <div className="space-y-4">
        {back}
        <NotConnected error={src.error} />
      </div>
    );
  }
  const d = src.data;
  const adv = d.advisors.find((a) => a.userId === params.userId) || null;
  const person = d.people.find((p) => p.userId === params.userId) || null;
  const name = adv?.name || person?.name || "（没找到这个人）";
  const filter = FILTERS.includes(searchParams.o as any) ? (searchParams.o as Outcome | "all") : "all";
  const calls = d.calls.filter((c) => c.userId === params.userId);
  const shown = filter === "all" ? calls : calls.filter((c) => c.outcome === filter);
  const count = (o: Outcome | "all") => (o === "all" ? calls.length : calls.filter((c) => c.outcome === o).length);
  const qs = (o: string) => {
    const q = new URLSearchParams();
    if (o !== "all") q.set("o", o);
    if (days !== 90) q.set("days", String(days));
    const s = q.toString();
    return s ? `?${s}` : "";
  };
  // 按阶段分组：约第一次会议的电话 / 约第二次 / 推成交
  const phases = (["before1", "before2", "after2"] as const).filter((p) => shown.some((c) => c.phase === p));

  return (
    <div className="space-y-5">
      {back}
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-xl md:text-2xl font-semibold">{name} 的通话</h1>
        <span className="text-sm text-stone-500">最近 {d.days} 天 · {calls.length} 通</span>
      </div>

      {adv && <FunnelStrip funnel={adv.funnel} conv={adv.conv} flags={d.flags.filter((f) => f.userId === params.userId)} />}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">放鸽子原因</h2>
        <div className="card p-4 space-y-4">
          {person && <CompareGrid s={person.stats} />}
          <ReportBlock r={person?.report || null} userId={params.userId} />
        </div>
      </section>

      {d.flags.some((f) => f.userId === params.userId) && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">不正常的环节</h2>
          <FlagList flags={d.flags.filter((f) => f.userId === params.userId)} showWho={false} />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">每一通电话</h2>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.filter((o) => o === "all" || count(o) > 0).map((o) => (
            <Link
              key={o}
              href={`/calls/${params.userId}${qs(o)}`}
              className={
                "rounded-full px-3 py-1 text-sm border " +
                (o === filter ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-700 border-stone-200")
              }
            >
              {o === "all" ? "全部" : OUTCOME[o].label} {count(o)}
            </Link>
          ))}
        </div>
        {shown.length === 0 ? (
          <div className="card p-4 text-sm text-stone-500">
            没有通话。打电话时在 CRM 客户页点「开始录制」，或者 Zoom 会议开云录像 + 文字稿，第二天这里就有。
          </div>
        ) : (
          phases.map((p) => (
            <div key={p} className="space-y-1">
              <div className="label pt-2">{PHASE[p]}的通话</div>
              <div className="card divide-y divide-stone-100">
                {shown
                  .filter((c) => c.phase === p)
                  .map((c) => (
                    <CallLine key={c.id} c={c} href={`/calls/${params.userId}/${c.id}`} />
                  ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
