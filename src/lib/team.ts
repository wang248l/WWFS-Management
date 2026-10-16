import { db } from "./db";

/**
 * 团队看板的数据层。行为数据不落本地库，每次打开时从姊妹系统现拉（只读）：
 *   CRM        GET /api/admin/team-activity   (X-API-Key: CRM_API_KEY)
 *   Marketing  GET /api/agent/ops-summary     (Bearer MARKETING_API_KEY)
 *   GitHub     最近合并的 PR                 (GITHUB_TOKEN，可选)
 * 任何一个源没配或挂了，看板照常出，只是那一块显示「未连接」。
 */

export const WINDOW_DAYS = 7;

export type CrmUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  excludeFromStats: boolean;
  followUps: number;
  followUpsToday: number;
  lastFollowUpAt: string | null;
  overdue: number;
  activityDays: number;
  journalDays: number;
  trainingAttempts: number;
  trainingAvgScore: number | null;
  closes: number;
};

export type MktPerson = {
  userId: string;
  name: string;
  email: string | null;
  filmMinutes: number;
  filmSessions: number;
  filmDays: number;
  lastFilmAt: string | null;
  inspirations: number;
};

export type MktAgents = {
  tokens: { label: string; prefix: string; scope: string; lastUsedAt: string | null }[];
  autoPublish: Record<string, number>;
  distribute: { jobs: number; variants: number; lastAt: string | null };
  analysis: { runs: number; failed: number; lastAt: string | null };
  followerSync: { trigger: string; status: string; startedAt: string; finishedAt: string | null; failed: number; total: number; error: string | null } | null;
  questionsNeedingHuman: number;
};

type Source<T> = { ok: true; data: T } | { ok: false; error: string };

async function getJson<T>(url: string, headers: Record<string, string>): Promise<Source<T>> {
  try {
    const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, data: (await res.json()) as T };
  } catch (e: any) {
    return { ok: false, error: e?.name === "TimeoutError" ? "超时" : String(e?.message || e) };
  }
}

export async function fetchCrm(): Promise<Source<{ users: CrmUser[] }>> {
  const base = process.env.CRM_API_BASE;
  const key = process.env.CRM_API_KEY;
  if (!base || !key) return { ok: false, error: "未配置 CRM_API_KEY" };
  return getJson(`${base.replace(/\/$/, "")}/api/admin/team-activity?days=${WINDOW_DAYS}`, { "x-api-key": key });
}

export async function fetchMarketing(): Promise<Source<{ people: MktPerson[]; agents: MktAgents }>> {
  const base = process.env.MARKETING_API_BASE;
  const key = process.env.MARKETING_API_KEY;
  if (!base || !key) return { ok: false, error: "未配置 MARKETING_API_KEY" };
  return getJson(`${base.replace(/\/$/, "")}/api/agent/ops-summary?days=${WINDOW_DAYS}`, { authorization: `Bearer ${key}` });
}

export type Merged = { repo: string; label: string; number: number; title: string; mergedAt: string; url: string };

export async function fetchMerged(): Promise<Source<Merged[]>> {
  const repos = (process.env.WATCH_REPOS || "wang248l/WWFS-CRM:CRM,wang248l/WWFS-Marketing:Marketing")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, error: "未配置 GITHUB_TOKEN" };
  const since = Date.now() - WINDOW_DAYS * 86400_000;
  const out: Merged[] = [];
  for (const spec of repos) {
    const [repo, label] = spec.split(":");
    const r = await getJson<any[]>(
      `https://api.github.com/repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=50`,
      { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
    );
    if (!r.ok) return { ok: false, error: `${repo}: ${r.error}` };
    for (const p of r.data) {
      if (!p.merged_at || Date.parse(p.merged_at) < since) continue;
      out.push({ repo, label: label || repo.split("/")[1], number: p.number, title: p.title, mergedAt: p.merged_at, url: p.html_url });
    }
  }
  out.sort((a, b) => b.mergedAt.localeCompare(a.mergedAt));
  return { ok: true, data: out };
}

// ---------------------------------------------------------------------------

const lc = (s: string | null | undefined) => (s || "").toLowerCase();
function matches(needle: string, ...hay: (string | null | undefined)[]) {
  const n = lc(needle).trim();
  return !!n && hay.some((h) => lc(h).includes(n));
}

export type Flag = { level: "red" | "amber"; text: string };

export type StaffRow = {
  id: string;
  name: string;
  role: string | null;
  weeklyFilmMinutes: number;
  crm: CrmUser | null;
  mkt: MktPerson | null;
  flags: Flag[];
};

export type AgentStatus = "ok" | "late" | "error" | "never" | "paused";

export type AgentRow = {
  id: string;
  key: string;
  name: string;
  duty: string | null;
  host: string | null;
  schedule: string | null;
  everyHours: number;
  graceHours: number;
  active: boolean;
  lastSeenAt: string | null;
  lastSeenVia: string | null;
  status: AgentStatus;
  runs7d: number;
  errors7d: number;
  outputs7d: number;
  recent: { task: string | null; status: string; summary: string | null; outputCount: number | null; at: string }[];
};

export function hoursAgo(iso: string | null): number | null {
  return iso ? (Date.now() - Date.parse(iso)) / 3600_000 : null;
}

export async function loadTeam() {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000);
  const [staff, agents, crm, mkt, merged] = await Promise.all([
    db.staff.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
    db.agent.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: { runs: { where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" } } },
    }),
    fetchCrm(),
    fetchMarketing(),
    fetchMerged(),
  ]);

  const crmUsers = crm.ok ? crm.data.users : [];
  const mktPeople = mkt.ok ? mkt.data.people : [];
  const usedCrm = new Set<string>();

  const staffRows: StaffRow[] = staff.map((s) => {
    const needle = s.matchName || s.name;
    const c = crmUsers.find((u) => matches(needle, u.name, u.email)) || null;
    if (c) usedCrm.add(c.id);
    const m = mktPeople.find((p) => matches(needle, p.name, p.email)) || null;
    const flags: Flag[] = [];
    if (crm.ok) {
      if (!c) flags.push({ level: "amber", text: "CRM 里没找到这个人" });
      else {
        if (c.overdue > 0) flags.push({ level: c.overdue >= 5 ? "red" : "amber", text: `${c.overdue} 个客户逾期未跟进` });
        const h = hoursAgo(c.lastFollowUpAt);
        if (h === null || h > 48) flags.push({ level: "red", text: h === null ? "从没写过跟进" : `${Math.floor(h / 24)} 天没写跟进` });
        if (c.activityDays < 3) flags.push({ level: "amber", text: `7 天只填了 ${c.activityDays} 天当日业绩` });
      }
    }
    if (mkt.ok && s.weeklyFilmMinutes > 0) {
      const mins = m?.filmMinutes || 0;
      if (mins < s.weeklyFilmMinutes)
        flags.push({ level: mins < s.weeklyFilmMinutes / 2 ? "red" : "amber", text: `拍摄 ${mins}/${s.weeklyFilmMinutes} 分钟` });
    }
    return { id: s.id, name: s.name, role: s.role, weeklyFilmMinutes: s.weeklyFilmMinutes, crm: c, mkt: m, flags };
  });

  const tokens = mkt.ok ? mkt.data.agents.tokens : [];
  const agentRows: AgentRow[] = agents.map((a) => {
    const lastRun = a.runs[0];
    let lastSeenAt: string | null = lastRun ? (lastRun.finishedAt || lastRun.createdAt).toISOString() : null;
    let lastSeenVia: string | null = lastRun ? "打卡" : null;
    if (a.tokenMatch) {
      for (const t of tokens) {
        if (!t.lastUsedAt || !matches(a.tokenMatch, t.label)) continue;
        if (!lastSeenAt || t.lastUsedAt > lastSeenAt) {
          lastSeenAt = t.lastUsedAt;
          lastSeenVia = `Marketing 钥匙「${t.label}」`;
        }
      }
    }
    const h = hoursAgo(lastSeenAt);
    let status: AgentStatus;
    if (!a.active) status = "paused";
    else if (h === null) status = "never";
    else if (h > a.everyHours + a.graceHours) status = "late";
    else if (lastRun?.status === "error") status = "error";
    else status = "ok";
    return {
      id: a.id,
      key: a.key,
      name: a.name,
      duty: a.duty,
      host: a.host,
      schedule: a.schedule,
      everyHours: a.everyHours,
      graceHours: a.graceHours,
      active: a.active,
      lastSeenAt,
      lastSeenVia,
      status,
      runs7d: a.runs.length,
      errors7d: a.runs.filter((r) => r.status === "error").length,
      outputs7d: a.runs.reduce((n, r) => n + (r.outputCount || 0), 0),
      recent: a.runs.slice(0, 5).map((r) => ({
        task: r.task,
        status: r.status,
        summary: r.summary,
        outputCount: r.outputCount,
        at: (r.finishedAt || r.createdAt).toISOString(),
      })),
    };
  });

  // CRM 里有动静、但没登记进名单的账号 —— 提醒补登记，免得有人在看板外面
  const unlisted = crmUsers.filter((u) => !usedCrm.has(u.id) && !u.excludeFromStats && u.role === "sales" && u.followUps > 0);

  // 今天要处理的异常：看板第一行
  const alerts: { who: string; level: "red" | "amber"; text: string }[] = [];
  for (const s of staffRows) for (const f of s.flags) alerts.push({ who: s.name, ...f });
  for (const a of agentRows) {
    if (a.status === "late") alerts.push({ who: a.name, level: "red", text: `超时未运行（应${a.schedule || `每 ${a.everyHours} 小时`}）` });
    if (a.status === "never") alerts.push({ who: a.name, level: "amber", text: "还没打过卡" });
    if (a.status === "error") alerts.push({ who: a.name, level: "red", text: "最近一次运行出错" });
  }
  if (mkt.ok) {
    const m = mkt.data.agents;
    if (m.questionsNeedingHuman > 0) alerts.push({ who: "Agent 收件箱", level: "amber", text: `${m.questionsNeedingHuman} 个问题等你回答` });
    if ((m.autoPublish.failed || 0) > 0) alerts.push({ who: "自动发布", level: "red", text: `7 天失败 ${m.autoPublish.failed} 条` });
    if (m.followerSync?.status === "failed") alerts.push({ who: "粉丝同步", level: "red", text: "最近一次失败" });
  }
  alerts.sort((x, y) => (x.level === y.level ? 0 : x.level === "red" ? -1 : 1));

  return { staffRows, agentRows, unlisted, alerts, crm, mkt, merged };
}
