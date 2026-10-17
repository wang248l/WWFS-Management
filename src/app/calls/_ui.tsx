import Link from "next/link";
import {
  FUNNEL_STEPS,
  VERDICT,
  OUTCOME,
  fmtDate,
  fmtDuration,
  type Funnel,
  type FunnelFlag,
  type TransitionKey,
  type CallStats,
  type PersonReport,
  type CallRow,
} from "@/lib/calls";

// 漏斗条：被标了异常的那一步转化率标红（低）/ 标黄（高得不正常）
export function FunnelStrip({
  funnel,
  conv,
  flags = [],
}: {
  funnel: Funnel;
  conv: Record<TransitionKey, number>;
  flags?: FunnelFlag[];
}) {
  return (
    <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
      {FUNNEL_STEPS.map((s, i) => {
        const prev = FUNNEL_STEPS[i - 1];
        const f = prev?.conv ? flags.find((x) => x.step === prev.conv) : undefined;
        const tone = f ? (f.kind === "low" ? "text-red-600" : "text-amber-600") : "text-stone-500";
        return (
          <div key={s.key} className="flex items-stretch gap-1 shrink-0">
            {prev?.conv && (
              <div className={"flex flex-col items-center justify-center px-0.5 min-w-[44px] text-[11px] font-semibold tabular-nums " + tone}>
                {conv[prev.conv]}%<span className="text-stone-300">→</span>
              </div>
            )}
            <div className={"rounded-lg border px-2.5 py-2 text-center min-w-[64px] " + (f?.kind === "low" ? "border-red-200 bg-red-50/40" : "border-stone-200 bg-white")}>
              <div className="text-lg font-semibold tabular-nums">{funnel[s.key]}</div>
              <div className="text-[11px] text-stone-500 whitespace-nowrap">{s.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function FlagList({ flags, showWho = true }: { flags: FunnelFlag[]; showWho?: boolean }) {
  if (!flags.length) return <div className="card p-4 text-emerald-700 font-medium">✓ 各环节转化率都在正常范围</div>;
  return (
    <div className="card divide-y divide-stone-100">
      {flags.map((f, i) => (
        <div key={i} className="px-4 py-3 flex items-start gap-3">
          <span className={"mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 " + (f.kind === "low" ? "bg-red-500" : "bg-amber-400")} />
          <div className="min-w-0">
            <div className="text-sm">
              {showWho && <span className="font-semibold mr-2">{f.userName}</span>}
              <span className="text-stone-500">{f.label}</span>
              <span className="badge ml-2 bg-stone-100 text-stone-600">
                {f.kind === "low" ? "低得不正常" : f.kind === "high" ? "高得不正常" : "数据缺失"}
              </span>
            </div>
            <div className="text-sm text-stone-800 mt-0.5">{f.message}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// 来了 vs 放鸽子：同一个数字两组并排，差距一眼看出
export function CompareGrid({ s }: { s: CallStats }) {
  const rows: { label: string; came: string; noShow: string }[] = [
    { label: "通话平均分", came: s.avgScoreCame != null ? String(s.avgScoreCame) : "—", noShow: s.avgScoreNoShow != null ? String(s.avgScoreNoShow) : "—" },
    { label: "约到 → 开会隔几天", came: s.avgGapCame != null ? `${s.avgGapCame}天` : "—", noShow: s.avgGapNoShow != null ? `${s.avgGapNoShow}天` : "—" },
    { label: "合格四条都问清", came: s.came ? `${s.allCriteriaMetCame}%` : "—", noShow: s.noShow ? `${s.allCriteriaMetNoShow}%` : "—" },
  ];
  return (
    <div className="rounded-lg border border-stone-200 overflow-hidden text-sm">
      <div className="grid grid-cols-3 bg-stone-50 text-xs text-stone-500">
        <div className="px-3 py-1.5" />
        <div className="px-3 py-1.5 text-emerald-700 font-medium">来了 {s.came}</div>
        <div className="px-3 py-1.5 text-red-700 font-medium">放鸽子 {s.noShow}</div>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-3 border-t border-stone-100">
          <div className="px-3 py-1.5 text-stone-500">{r.label}</div>
          <div className="px-3 py-1.5 font-semibold tabular-nums">{r.came}</div>
          <div className="px-3 py-1.5 font-semibold tabular-nums">{r.noShow}</div>
        </div>
      ))}
    </div>
  );
}

export function ReportBlock({ r, compact = false, userId }: { r: PersonReport | null; compact?: boolean; userId?: string | null }) {
  if (!r) return <p className="text-sm text-stone-400">还没有放鸽子原因报告（CRM 每天凌晨 2 点跑）</p>;
  if (!r.report) return <p className="text-sm text-stone-500">报告没生成：{r.error || "未知原因"}</p>;
  const rep = r.report;
  const v = VERDICT[rep.verdict];
  const causes = compact ? rep.causes.slice(0, 3) : rep.causes;
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 flex-wrap">
        <span className={"badge " + v.cls}>{v.label}</span>
        <span className="font-semibold text-stone-900">{rep.headline}</span>
      </div>
      {!compact && rep.verdictReason && <p className="text-sm text-stone-700">{rep.verdictReason}</p>}
      {causes.length > 0 && (
        <div>
          <div className="label mb-1">放鸽子的共同原因</div>
          <ol className="space-y-2">
            {causes.map((c, i) => (
              <li key={i} className="text-sm">
                <div className="font-medium">
                  {i + 1}. {c.cause}
                </div>
                {!compact && c.evidence.length > 0 && (
                  <ul className="mt-1 ml-4 space-y-0.5 text-stone-600 list-disc">
                    {c.evidence.map((e, j) => (
                      <li key={j}>{e}</li>
                    ))}
                  </ul>
                )}
                {!compact && userId && c.calls.length > 0 && (
                  <div className="mt-1 ml-4 flex flex-wrap gap-1">
                    {c.calls.slice(0, 8).map((id, j) => (
                      <Link key={id} href={`/calls/${userId}/${id}`} className="badge bg-brand-50 text-brand-700 hover:bg-brand-100">
                        通话 {j + 1}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      {rep.fixes.length > 0 && (
        <div>
          <div className="label mb-1">下次怎么做</div>
          <ul className="space-y-1 text-sm">
            {(compact ? rep.fixes.slice(0, 2) : rep.fixes).map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-emerald-600">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!compact && rep.nonCallFactors.length > 0 && (
        <div>
          <div className="label mb-1">电话以外的原因</div>
          <ul className="space-y-1 text-sm list-disc ml-4 text-stone-700">
            {rep.nonCallFactors.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {!compact && rep.dataGaps.length > 0 && (
        <div className="text-xs text-stone-500">还缺的数据：{rep.dataGaps.join("；")}</div>
      )}
      <div className="text-xs text-stone-400">
        {fmtDate(r.createdAt)} 生成 · 最近 {r.periodDays} 天的通话
      </div>
    </div>
  );
}

export function OutcomeBadge({ o }: { o: CallRow["outcome"] }) {
  return <span className={"badge whitespace-nowrap " + OUTCOME[o].cls}>{OUTCOME[o].label}</span>;
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-stone-400">—</span>;
  const cls = score >= 75 ? "text-emerald-700" : score >= 60 ? "text-amber-700" : "text-red-700";
  return <span className={"font-semibold tabular-nums " + cls}>{score}</span>;
}

export function CallLine({ c, href }: { c: CallRow; href: string }) {
  return (
    <Link href={href} className="block px-4 py-3 hover:bg-stone-50">
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <span className="text-stone-500 tabular-nums w-12 shrink-0">{fmtDate(c.startedAt)}</span>
        <span className="font-semibold">{c.customerName}</span>
        <span className="text-xs text-stone-400">
          {c.kind === "zoom" ? "Zoom 会议" : "电话"} · {fmtDuration(c.durationSec)}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <ScoreBadge score={c.score} />
          <OutcomeBadge o={c.outcome} />
        </span>
      </div>
      {c.status === "done" ? (
        <p className="text-sm text-stone-600 mt-1 line-clamp-2">{c.summary || "（没有摘要）"}</p>
      ) : (
        <p className="text-sm text-amber-700 mt-1">{c.status === "error" ? `没分析成：${c.error || "未知原因"}` : "还在分析"}</p>
      )}
      {c.status === "done" && c.improvements[0] && (
        <p className="text-xs text-red-700 mt-1 line-clamp-1">要改：{c.improvements[0]}</p>
      )}
    </Link>
  );
}

export function NotConnected({ error }: { error: string }) {
  return (
    <div className="card p-5 space-y-1">
      <div className="font-semibold">通话分析暂时拿不到数据</div>
      <p className="text-sm text-stone-600">{error}</p>
    </div>
  );
}
