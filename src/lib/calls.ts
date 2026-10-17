/**
 * 通话分析的数据层（/calls 页面）。跟团队看板一样不落本地库，每次打开时从 CRM 现拉（只读）：
 *   GET /api/admin/call-insights            整包：漏斗、异常、每人报告、每通电话
 *   GET /api/admin/call-insights/calls/:id  一通电话的逐字稿和完整点评
 * 鉴权都是 X-API-Key: CRM_API_KEY。CRM 每天凌晨 2 点（多伦多）自动跑一次分析。
 */

export type Outcome = "came" | "no_show" | "not_booked" | "pending" | "handed_off" | "closed" | "open";

export const OUTCOME: Record<Outcome, { label: string; cls: string }> = {
  came: { label: "来了", cls: "bg-emerald-50 text-emerald-700" },
  no_show: { label: "放鸽子", cls: "bg-red-50 text-red-700" },
  not_booked: { label: "没约到", cls: "bg-amber-50 text-amber-700" },
  pending: { label: "会议还没到", cls: "bg-sky-50 text-sky-700" },
  handed_off: { label: "约给别人开", cls: "bg-violet-50 text-violet-700" },
  closed: { label: "成交了", cls: "bg-emerald-50 text-emerald-700" },
  open: { label: "还没成交", cls: "bg-stone-100 text-stone-600" },
};

export const PHASE: Record<string, string> = {
  before1: "约第一次会议",
  before2: "约第二次会议",
  after2: "推成交",
};

type Criterion = { met: "yes" | "no" | "unknown"; evidence?: string };
export type Criteria = { need: Criterion; budget: Criterion; decider: Criterion; timeline: Criterion };

export type CallRow = {
  id: string;
  userId: string | null;
  userName: string;
  customerId: string;
  customerName: string;
  kind: string;
  startedAt: string;
  durationSec: number;
  status: string;
  score: number | null;
  phase: "before1" | "before2" | "after2";
  outcome: Outcome;
  gapDays: number | null;
  summary: string;
  criteria: Criteria | null;
  concerns: string[];
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
  error: string | null;
};

export type CallStats = {
  calls: number;
  analyzed: number;
  failed: number;
  zoomMeetings: number;
  avgScore: number | null;
  came: number;
  noShow: number;
  pending: number;
  notBooked: number;
  handedOff: number;
  avgScoreCame: number | null;
  avgScoreNoShow: number | null;
  avgGapCame: number | null;
  avgGapNoShow: number | null;
  allCriteriaMetCame: number;
  allCriteriaMetNoShow: number;
};

export type Report = {
  headline: string;
  verdict: "call" | "other" | "mixed" | "unknown";
  verdictReason: string;
  causes: { cause: string; evidence: string[]; calls: string[] }[];
  nonCallFactors: string[];
  fixes: string[];
  dataGaps: string[];
};

export type Funnel = {
  leads: number;
  leadsPending: number;
  phone: number;
  connected: number;
  qualified: number;
  booked: number;
  bookedPending: number;
  zoom1: number;
  booked2: number;
  booked2Pending: number;
  zoom2: number;
  closed: number;
  handedOff: number;
  handedOffAttended: number;
  handedOffClosed: number;
};

export type TransitionKey =
  | "leadToPhone"
  | "phoneToConnected"
  | "connectedToQualified"
  | "connectedToBooked"
  | "phoneToZoom1"
  | "zoom1ToBooked2"
  | "zoom1ToZoom2"
  | "zoom2ToClosed";

export type FunnelFlag = {
  userId: string | null;
  userName: string;
  step: string;
  label: string;
  rate: number;
  team: number | null;
  target: number | null;
  n: number;
  kind: "low" | "high" | "data";
  message: string;
};

export type PersonReport = {
  userId: string | null;
  userName: string;
  createdAt: string;
  periodDays: number;
  stats: CallStats;
  report: Report | null;
  error: string | null;
};

export type Insights = {
  generatedAt: string;
  days: number;
  lastRunAt: string | null;
  lastRunLog: string[];
  team: { stats: CallStats; funnel: Funnel; conv: Record<TransitionKey, number>; cancelled: number; qualified: number; qualifiedArchived: number };
  advisors: {
    userId: string;
    name: string;
    funnel: Funnel;
    conv: Record<TransitionKey, number>;
    cancelled: number;
    qualified: number;
    qualifiedArchived: number;
    calls: { userId: string | null; name: string; stats: CallStats; report: PersonReport | null } | null;
  }[];
  people: { userId: string | null; name: string; stats: CallStats; report: PersonReport | null }[];
  flags: FunnelFlag[];
  targets: Record<string, number>;
  calls: CallRow[];
};

export type CallDetail = {
  id: string;
  userName: string;
  kind: string;
  startedAt: string;
  durationSec: number;
  transcript: string | null;
  transcriptSource: string | null;
  analysis: (Omit<CallRow, "id"> & { criteria: Criteria; bookedMeeting?: boolean; meetingNote?: string; connected?: boolean }) | null;
  score: number | null;
  status: string;
  error: string | null;
  customer: { id: string; name: string };
};

type Source<T> = { ok: true; data: T } | { ok: false; error: string };

async function crmGet<T>(path: string, timeoutMs = 15000): Promise<Source<T>> {
  const base = process.env.CRM_API_BASE;
  const key = process.env.CRM_API_KEY;
  if (!base || !key) return { ok: false, error: "未配置 CRM_API_KEY" };
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      headers: { "x-api-key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status === 404) return { ok: false, error: "CRM 还没有通话分析接口（等 CRM 那边更新上线）" };
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, data: (await res.json()) as T };
  } catch (e: any) {
    return { ok: false, error: e?.name === "TimeoutError" ? "超时" : String(e?.message || e) };
  }
}

export function fetchInsights(days = 90, userId?: string | null) {
  const q = new URLSearchParams({ days: String(days) });
  if (userId) q.set("userId", userId);
  return crmGet<Insights>(`/api/admin/call-insights?${q}`);
}

export function fetchCall(id: string) {
  return crmGet<CallDetail>(`/api/admin/call-insights/calls/${encodeURIComponent(id)}`);
}

export const CRM_PUBLIC = () => (process.env.CRM_PUBLIC_URL || process.env.CRM_API_BASE || "").replace(/\/$/, "");

// 漏斗条：每一步的人数 + 到下一步的转化率（转化率 key 跟 CRM lib/kpi.ts 的 TRANSITIONS 对齐）
export const FUNNEL_STEPS: { key: keyof Funnel; label: string; conv?: TransitionKey }[] = [
  { key: "leads", label: "新客资", conv: "leadToPhone" },
  { key: "phone", label: "拨打", conv: "phoneToConnected" },
  { key: "connected", label: "接通", conv: "connectedToQualified" },
  { key: "qualified", label: "合格", conv: "connectedToBooked" },
  { key: "booked", label: "约到会议", conv: "phoneToZoom1" },
  { key: "zoom1", label: "第一次出席", conv: "zoom1ToBooked2" },
  { key: "booked2", label: "约到第二次", conv: "zoom1ToZoom2" },
  { key: "zoom2", label: "第二次出席", conv: "zoom2ToClosed" },
  { key: "closed", label: "成交" },
];

export const VERDICT: Record<Report["verdict"], { label: string; cls: string }> = {
  call: { label: "主要是电话的问题", cls: "bg-red-50 text-red-700" },
  other: { label: "主要不是电话的问题", cls: "bg-amber-50 text-amber-700" },
  mixed: { label: "电话和其他原因都有", cls: "bg-amber-50 text-amber-700" },
  unknown: { label: "数据还不够下结论", cls: "bg-stone-100 text-stone-600" },
};

export function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "America/Toronto", month: "numeric", day: "numeric" }).format(new Date(iso));
}

export function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/Toronto",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function fmtDuration(sec: number) {
  const m = Math.round(sec / 60);
  return m < 1 ? `${sec}秒` : `${m}分钟`;
}
