import { db } from "./db";

/**
 * 视频号助手扫码登录（2026-11-23 Wallace 选「每天早上在 Management 首页扫码」）。
 * Omen PC 的发布脚本把视频号助手网页的登录二维码截图 + 状态推上来，首页卡片实时显示。
 * 存在 Setting 表：sph:<account> = JSON（二维码 base64 也在里面，一张 < 1MB）。
 */
export type SphStatus = "need_scan" | "logged_in" | "expired" | "error";
export const SPH_STATUSES: SphStatus[] = ["need_scan", "logged_in", "expired", "error"];
export const SPH_ACCOUNTS: Record<string, string> = { wallace: "加拿大Wallace 视频号", amelia: "Amelia 视频号" };
// 阿尔伯塔现在常年 UTC-6；服务器 tzdata 可能还是老的 Edmonton 规则，跟手机一样用 Regina（常年 UTC-6）
export const SPH_TZ = "America/Regina";
/** 二维码超过这么久没刷新，就当它已经失效（微信网页二维码一般几分钟就过期）。 */
export const QR_STALE_MS = 5 * 60_000;

export type SphState = {
  account: string;
  status: SphStatus;
  qr: string | null; // base64（不带 data: 前缀）
  qrMime: string;
  qrAt: string | null;
  loggedInAt: string | null;
  note: string | null;
  host: string | null;
  updatedAt: string;
  refreshRequestedAt: string | null;
};

export const sphKey = (account: string) => `sph:${account}`;

export function normAccount(a: unknown): string | null {
  const k = String(a ?? "wallace").trim().toLowerCase() || "wallace";
  return /^[a-z0-9_-]{1,32}$/.test(k) ? k : null;
}

export async function getSph(account: string): Promise<SphState | null> {
  const row = await db.setting.findUnique({ where: { key: sphKey(account) } }).catch(() => null);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as SphState;
  } catch {
    return null;
  }
}

export async function saveSph(s: SphState) {
  const value = JSON.stringify(s);
  await db.setting.upsert({ where: { key: sphKey(s.account) }, update: { value }, create: { key: sphKey(s.account), value } });
}

/** Wallace 当地（UTC-6）当天的 YYYY-MM-DD。 */
export function dayIn(d: Date | string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SPH_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
}
export function timeIn(d: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: SPH_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d));
}

/** 给首页用的精简视图（不带二维码本体，图片走 /api/sph/qr）。 */
export type SphViewState = "none" | "logged_in" | "logged_in_old" | "scan" | "qr_stale" | "expired" | "error";
export type SphView = {
  account: string; label: string; state: SphViewState;
  loggedInAt: string | null; loggedInTime: string | null; qrAt: string | null; qrVersion: number;
  note: string | null; host: string | null; updatedAt: string | null; refreshRequestedAt: string | null;
};
export function publicView(s: SphState | null, account: string): SphView {
  const now = Date.now();
  if (!s)
    return { account, label: SPH_ACCOUNTS[account] || account, state: "none", loggedInAt: null, loggedInTime: null, qrAt: null, qrVersion: 0, note: null, host: null, updatedAt: null, refreshRequestedAt: null };
  const loggedToday = s.status === "logged_in" && !!s.loggedInAt && dayIn(s.loggedInAt) === dayIn(new Date());
  const qrFresh = s.status === "need_scan" && !!s.qr && !!s.qrAt && now - new Date(s.qrAt).getTime() < QR_STALE_MS;
  const state: SphViewState = loggedToday
    ? ("logged_in" as const)
    : s.status === "logged_in"
      ? ("logged_in_old" as const) // 登录过但不是今天：多半已过期，等 Omen 推新码
      : s.status === "need_scan"
        ? qrFresh
          ? ("scan" as const)
          : ("qr_stale" as const)
        : s.status;
  return {
    account,
    label: SPH_ACCOUNTS[account] || account,
    state,
    loggedInAt: s.loggedInAt,
    loggedInTime: s.loggedInAt ? timeIn(s.loggedInAt) : null,
    qrAt: s.qrAt,
    qrVersion: s.qrAt ? new Date(s.qrAt).getTime() : 0,
    note: s.note,
    host: s.host,
    updatedAt: s.updatedAt,
    refreshRequestedAt: s.refreshRequestedAt,
  };
}
