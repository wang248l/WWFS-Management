import { getJson } from "./team";

/**
 * 「你怎么知道谁卡住了」（2026-11-05 Wallace）：Mac 上每件事都记进 AI 工作日志（ok 绿 / fail 红，带 哪里/原因/怎么处理），
 * 日志推到 Marketing 网站。办公室从 Marketing 的 GET /api/agent/ai-log 读（MARKETING_API_KEY 只读钥匙），不用改任何任务。
 *
 * 归属：mark:* / 报告 → Mark；剪辑、QC、发布、定时、登录检查、Drive上传、巡检、工单 → Chase（key mac）。
 * 卡住 = 同一件事（任务 + IP + 平台）最近一条是 fail，并且在 24 小时内；后面又成功了就不算。
 *
 * 还要按「结果」查（2026-11-05 Wallace：「之前就有一次，IG 连续五天没发东西，最后发现是 Claude 没有读到 Drive 里面的视频」——
 * 那次没报错，只是什么都没做）：近 14 天发过的每个「IP + 平台」，超过排程（Wallace 2 天、其他 IP 3 天）再加 1 天
 * 还没有一条发布成功，就算 Chase 卡住：「Amelia · IG 已经 5 天没发出去」。
 */
export type AiEntry = { id: string; ts: string; source: string; status: string; task: string; ip: string; platform: string; video: string; msg: string; where: string | null; why: string | null; fix: string | null };
export type AiAgentState = { lastAt: string | null; lastMsg: string | null; lastStatus: string | null; stuck: AiEntry[]; count24h: number; fail24h: number };

// IP 发布间隔（天），见 ip-posting-schedule：Wallace 每 2 天，其他每 3 天；再宽限 1 天才算断更
const PUBLISH_EVERY_DAYS: Record<string, number> = { Wallace: 2 };
const PUBLISH_DEFAULT_DAYS = 3;
const PUBLISH_GRACE_DAYS = 1;

const CHASE_TASKS = new Set(["剪辑", "QC", "发布", "定时", "登录检查", "Drive上传", "巡检", "工单"]);

export function agentForEntry(e: AiEntry): string | null {
  const tag = `${e.source} ${e.video}`.toLowerCase();
  if (/(^|\W)mark[:\s]/.test(tag) || tag.includes("mark.duty") || e.task === "报告") return "mark";
  if (tag.includes("增员")) return "recruit";
  if (CHASE_TASKS.has(e.task)) return "mac";
  return null;
}

export async function loadAiLog(): Promise<{ ok: boolean; byAgent: Record<string, AiAgentState> }> {
  const base = process.env.MARKETING_API_BASE;
  const key = process.env.MARKETING_API_KEY;
  if (!base || !key) return { ok: false, byAgent: {} };
  const r = await getJson<{ entries: AiEntry[] }>(`${base.replace(/\/$/, "")}/api/agent/ai-log?hours=336&limit=3000`, { authorization: `Bearer ${key}` });
  if (!r.ok) return { ok: false, byAgent: {} };
  const byAgent: Record<string, AiAgentState> = {};
  const latestByKey: Record<string, Record<string, AiEntry>> = {};
  const day = Date.now() - 86400_000;
  for (const e of r.data.entries) {
    // entries come newest first
    const who = agentForEntry(e);
    if (!who) continue;
    const s = (byAgent[who] ||= { lastAt: null, lastMsg: null, lastStatus: null, stuck: [], count24h: 0, fail24h: 0 });
    if (!s.lastAt) Object.assign(s, { lastAt: e.ts, lastMsg: e.msg, lastStatus: e.status });
    const t = Date.parse(e.ts);
    if (t >= day) {
      s.count24h++;
      if (e.status === "fail") s.fail24h++;
    }
    if (e.status === "run") continue;
    const k = `${e.task}|${e.ip}|${e.platform}`;
    const m = (latestByKey[who] ||= {});
    if (!m[k]) m[k] = e;
  }
  for (const [who, m] of Object.entries(latestByKey)) {
    byAgent[who].stuck = Object.values(m).filter((e) => e.status === "fail" && Date.parse(e.ts) >= day);
  }

  // 断更：每个「IP + 平台」最后一次发布成功
  const lastPublish: Record<string, AiEntry> = {};
  for (const e of r.data.entries) {
    if (e.task !== "发布" || e.status !== "ok" || e.ip === "-" || e.platform === "-") continue;
    const k = `${e.ip}|${e.platform}`;
    if (!lastPublish[k]) lastPublish[k] = e;
  }
  for (const e of Object.values(lastPublish)) {
    const days = (Date.now() - Date.parse(e.ts)) / 86400_000;
    const every = PUBLISH_EVERY_DAYS[e.ip] ?? PUBLISH_DEFAULT_DAYS;
    if (days <= every + PUBLISH_GRACE_DAYS) continue;
    const s = (byAgent.mac ||= { lastAt: null, lastMsg: null, lastStatus: null, stuck: [], count24h: 0, fail24h: 0 });
    s.stuck.unshift({
      ...e,
      id: `gap-${e.ip}-${e.platform}`,
      status: "fail",
      msg: `${e.ip} · ${e.platform} 已经 ${Math.floor(days)} 天没发出去（应每 ${every} 天一条）`,
      where: "发布结果（没有报错，但没有发布成功的记录）",
      why: `最后一次发布成功：${e.ts.slice(0, 10)}「${e.msg.slice(0, 60)}」`,
      fix: "查这个 IP 的成片有没有进 Drive、发布任务有没有跑",
    });
  }
  return { ok: true, byAgent };
}

/** 悬停用的一句话：事情 + 卡在哪（原因太长就不放，点进工位看全文）。 */
export function stuckLine(e: AiEntry): string {
  const why = e.why && e.why.length <= 40 ? ` 原因：${e.why}` : "";
  return `${e.msg}${e.where ? `（卡在：${e.where}）` : ""}${why}`;
}
