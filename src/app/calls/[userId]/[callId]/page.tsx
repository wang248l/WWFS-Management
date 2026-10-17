import Link from "next/link";
import { fetchCall, fetchInsights, CRM_PUBLIC, PHASE, fmtDateTime, fmtDuration } from "@/lib/calls";
import { OutcomeBadge, ScoreBadge, NotConnected } from "../../_ui";

export const dynamic = "force-dynamic";

// 一通电话：结果、AI 点评（合格四条、顾虑、做得好、要改、下一步）、逐字稿。
const CRIT: { key: "need" | "budget" | "decider" | "timeline"; label: string }[] = [
  { key: "need", label: "有需求" },
  { key: "budget", label: "有预算" },
  { key: "decider", label: "能做决定" },
  { key: "timeline", label: "3个月内行动" },
];
const MET = {
  yes: { label: "✓", cls: "text-emerald-700" },
  no: { label: "✗", cls: "text-red-700" },
  unknown: { label: "没问到", cls: "text-amber-700" },
};

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="label mb-1">{title}</div>
      <ul className="space-y-1 text-sm">
        {items.map((x, i) => (
          <li key={i} className="flex gap-2">
            <span className={tone}>•</span>
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function CallDetailPage({ params }: { params: { userId: string; callId: string } }) {
  const [src, list] = await Promise.all([fetchCall(params.callId), fetchInsights(180, params.userId)]);
  const back = (
    <Link href={`/calls/${params.userId}`} className="text-sm text-brand-700 hover:underline">
      ← 所有通话
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
  const c = src.data;
  const a = c.analysis;
  const row = list.ok ? list.data.calls.find((x) => x.id === c.id) : undefined;
  const crm = CRM_PUBLIC();

  return (
    <div className="space-y-5 max-w-3xl">
      {back}
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl md:text-2xl font-semibold">{c.customer.name}</h1>
          {row && <OutcomeBadge o={row.outcome} />}
        </div>
        <div className="text-sm text-stone-500">
          {c.userName} · {c.kind === "zoom" ? "Zoom 会议" : "电话"} · {fmtDateTime(c.startedAt)} · {fmtDuration(c.durationSec)}
          {row ? ` · ${PHASE[row.phase]}` : ""}
          {row?.gapDays != null ? ` · 约到后隔 ${row.gapDays} 天开会` : ""}
        </div>
        {crm && (
          <a href={`${crm}/leads/${c.customer.id}`} target="_blank" rel="noreferrer" className="text-sm text-brand-700 hover:underline">
            在 CRM 打开客户 ↗
          </a>
        )}
      </div>

      {c.status !== "done" || !a ? (
        <div className="card p-4 text-sm text-amber-700">{c.status === "error" ? `没分析成：${c.error || "未知原因"}` : "还在分析"}</div>
      ) : (
        <div className="card p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl">
              <ScoreBadge score={c.score} />
            </div>
            <p className="text-sm text-stone-700">{a.summary}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {CRIT.map((k) => {
              const v = a.criteria?.[k.key];
              const m = MET[v?.met || "unknown"];
              return (
                <div key={k.key} className="rounded-lg bg-stone-50 px-3 py-2" title={v?.evidence || ""}>
                  <div className={"font-semibold " + m.cls}>{m.label}</div>
                  <div className="text-xs text-stone-500">{k.label}</div>
                  {v?.evidence && <div className="text-[11px] text-stone-400 mt-0.5 line-clamp-2">{v.evidence}</div>}
                </div>
              );
            })}
          </div>
          {a.meetingNote && (
            <p className="text-sm">
              <span className="text-stone-500">约会议：</span>
              {a.meetingNote}
            </p>
          )}
          <List title="客户的顾虑" items={a.concerns || []} tone="text-amber-600" />
          <List title="要改的地方" items={a.improvements || []} tone="text-red-600" />
          <List title="做得好的" items={a.strengths || []} tone="text-emerald-600" />
          <List title="下一步" items={a.nextSteps || []} tone="text-brand-600" />
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">逐字稿</h2>
        {c.transcript ? (
          <div className="card p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-[70vh] overflow-y-auto">{c.transcript}</div>
        ) : (
          <div className="card p-4 text-sm text-stone-500">没有逐字稿</div>
        )}
        <p className="text-xs text-stone-400">
          {c.transcriptSource === "service" ? "语音转文字服务转写" : c.transcriptSource === "zoom" ? "Zoom 云录像文字稿" : "浏览器边录边转"}，可能有错字、没分说话人。
        </p>
      </section>
    </div>
  );
}
