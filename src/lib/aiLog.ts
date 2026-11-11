import { getJson } from "./team";
import { setting } from "./settings";
import { createHash } from "crypto";
import { db } from "./db";

/**
 * 「你怎么知道谁卡住了」（2026-11-05 Wallace）：Mac 上每件事都记进 AI 工作日志（ok 绿 / fail 红，带 哪里/原因/怎么处理），
 * 日志推到 Marketing 网站。办公室从 Marketing 的 GET /api/agent/ai-log 读（MARKETING_API_KEY 只读钥匙），不用改任何任务。
 *
 * 归属：mark:* / 报告 → Mark；剪辑、QC、发布、定时、登录检查、Drive上传、巡检、工单 → Chase（key mac）。
 * 卡住 = 同一件事（任务 + IP + 平台）最近一条是 fail，并且在 24 小时内；后面又成功了就不算。
 *
 * 「没报错、但什么都没发生」（2026-11-05 Wallace：「IG 连续五天没发东西……需要一套倒推的检查体系」）由 Mac 上的
 * ~/autocut/backtrace.py 查：从每个 IP × 平台的发布结果往回推到 发布 / 成片 / 剪辑 / 原片 / 扫描，断在哪一环就记一条
 * 「巡检」fail 进工作日志，这里照常读到，显示在 Chase 头上。
 */
export type AiEntry = { id: string; ts: string; source: string; status: string; task: string; ip: string; platform: string; video: string; msg: string; where: string | null; why: string | null; fix: string | null; resolved?: boolean };
export type AiAgentState = { lastAt: string | null; lastMsg: string | null; lastStatus: string | null; stuck: AiEntry[]; count24h: number; fail24h: number; findings?: AiEntry[]; entries: AiEntry[] };

const CHASE_TASKS = new Set(["剪辑", "QC", "发布", "定时", "登录检查", "Drive上传", "巡检", "工单"]);

export function agentForEntry(e: AiEntry): string | null {
  // 每日汇报（daily_agent_report.py）和 Mark 每一步都用 video 前缀点名：chase: / mac: / mark:
  const v = (e.video || "").toLowerCase();
  if (v.startsWith("chase:")) return "mac";
  if (v.startsWith("mac:")) return "macmini";
  if (v.startsWith("mark:")) return "mark";
  const tag = `${e.source} ${e.video}`.toLowerCase();
  if (/(^|\W)mark[:\s]/.test(tag) || tag.includes("mark.duty") || e.task === "报告") return "mark";
  if (tag.includes("增员")) return "recruit";
  // 2026-11-06 分工：剪辑 / QC 归 Leo，发布 / 定时 / 登录 / 上传 / 巡检 归 Chase（key mac）
  if (e.task === "剪辑" || e.task === "QC") return "leo";
  if (v.startsWith("leo:")) return "leo";
  if (CHASE_TASKS.has(e.task)) return "mac";
  return null;
}

/**
 * 「一定需要人工介入的在页面里面显示出来」（2026-11-06 Wallace）：Ivy 每次巡检把要你亲自处理的问题记成「【需要你】…」，
 * 这里只取她最近一次巡检那一批（同一次跑 15 分钟内记的），已经好了的下次巡检就不会再出现。
 */
export function humanTodos(entries: AiEntry[]): AiEntry[] {
  const lastRun = entries.find((e) => e.source.includes("ivy") && e.task === "其他");
  if (!lastRun) return [];
  const t0 = Date.parse(lastRun.ts) - 30 * 60_000;
  const seen = new Set<string>();
  return entries.filter((e) => {
    if (e.resolved || !e.msg.startsWith("【需要你】") || Date.parse(e.ts) < t0 || Date.parse(e.ts) > Date.parse(lastRun.ts) + 60_000) return false;
    const k = e.msg;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * 「如何标记问题已经解决让他不再报错」（2026-11-08 Wallace）：点「标记已解决」按问题记一个指纹，不按某一条日志记，
 * 所以同一个问题下次巡检再记一条也不会亮红。天数、条数、日期会变，去掉再比（「上一条是 3.5 天前」和「4.5 天前」是同一个问题）。
 * 只管 7 天：过了 7 天还在报，多半是真的又坏了，要重新亮出来。
 */
const RESOLVED_DAYS = 7;
export function issueSig(e: Pick<AiEntry, "task" | "ip" | "platform" | "video" | "msg">): string {
  const msg = e.msg.replace("【需要你】", "").replace(/\d{4}-\d{2}-\d{2}/g, "#").replace(/\d+(\.\d+)?\s*(天|小时|分钟|条|次|%)/g, "#$2").trim();
  return createHash("sha256").update([e.task, e.ip, e.platform, e.video, msg].join("|"), "utf8").digest("hex");
}

/** 老板的按钮和 agent 的钥匙走同一个入口：按日志 id 找到这一条，记下它的指纹。 */
export async function resolveIssue(id: string, by: string): Promise<boolean> {
  const e = await db.aiLogEntry.findUnique({ where: { id } });
  if (!e) return false;
  const sig = issueSig(e);
  const row = { agentKey: agentForEntry({ ...e, ts: e.ts.toISOString() }), msg: e.msg.slice(0, 500), by, resolvedAt: new Date() };
  await db.resolvedIssue.upsert({ where: { sig }, create: { sig, ...row }, update: row });
  return true;
}

export async function loadAiLog(): Promise<{ ok: boolean; byAgent: Record<string, AiAgentState>; human: AiEntry[] }> {
  const resolved = new Map((await db.resolvedIssue.findMany().catch(() => [])).map((r) => [r.sig, r.resolvedAt.getTime()]));
  // 优先读 Mac 直接推到办公室的日志（2026-11-06 配对以后）；48 小时里一条都没有，再去 Marketing 拉
  const local = await db.aiLogEntry
    .findMany({ where: { ts: { gte: new Date(Date.now() - 48 * 3600_000) } }, orderBy: { ts: "desc" }, take: 2000 })
    .catch(() => []);
  if (local.length) return digest(local.map((e) => ({ ...e, ts: e.ts.toISOString() })), resolved);
  const base = process.env.MARKETING_API_BASE || "https://marketing.wallacewang.ca";
  const key = await setting("MARKETING_API_KEY");
  if (!base || !key) return { ok: false, byAgent: {}, human: [] };
  const r = await getJson<{ entries: AiEntry[] }>(`${base.replace(/\/$/, "")}/api/agent/ai-log?hours=48&limit=2000`, { authorization: `Bearer ${key}` });
  if (!r.ok) return { ok: false, byAgent: {}, human: [] };
  return digest(r.data.entries, resolved);
}

function digest(all: AiEntry[], resolved: Map<string, number>): { ok: boolean; byAgent: Record<string, AiAgentState>; human: AiEntry[] } {
  const r = { data: { entries: all } };
  const byAgent: Record<string, AiAgentState> = {};
  const latestByKey: Record<string, Record<string, AiEntry>> = {};
  const day = Date.now() - 86400_000;
  // 2026-11-06：「Ben 和 Ishan 先删掉吧，过不了实习期也不算是我们的员工」——他们的记录不再算到任何人头上
  r.data.entries = r.data.entries.filter((e) => !["Ben", "Ishan"].includes((e.ip || "").split(" ")[0]));
  // 2026-11-11 Wallace「Ivy 的每日巡检还是有很多报错」：Ivy 的问题原来按 24 小时全算，上一轮巡检的老问题（包括已经修掉的误报）
  // 要挂满一天。改为：ivy.py 每轮都把还在的问题重新记一遍，所以只认她最近一轮；backtrace.py 同一个断点一天只记一次，
  // 所以只有它最近一次打卡说「没有断的环」时，才把它更早的断点当作已经好了。
  const ivyRun = r.data.entries.find((e) => e.source.includes("ivy") && e.task === "其他");
  const ivyFrom = ivyRun ? Date.parse(ivyRun.ts) - 30 * 60_000 : -Infinity;
  const btRun = r.data.entries.find((e) => e.source.includes("backtrace") && e.task === "其他");
  const btClear = btRun && btRun.msg.includes("没有断的环") ? Date.parse(btRun.ts) : -Infinity;
  const superseded = (e: AiEntry) =>
    e.status === "fail" &&
    ((e.source.includes("ivy") && Date.parse(e.ts) < ivyFrom) || (e.source.includes("backtrace") && Date.parse(e.ts) < btClear));
  for (const e of r.data.entries) {
    const at = e.status === "fail" ? resolved.get(issueSig(e)) : undefined;
    e.resolved = (at !== undefined && Date.parse(e.ts) <= at + RESOLVED_DAYS * 86400_000) || superseded(e);
    // 检查员 Ivy（2026-11-05）：ivy.py（第三方看公开页）和 backtrace.py（倒推）每跑一次记一条「其他 ok」= 她的打卡；她记的「巡检 fail」= 查出的问题，
    // 断点照常算在负责的人（Chase）头上，这里另存一份给她的工位看
    // MAC（2026-11-05「MAC 设备要单独成为一个角色」）：日志全是这台 Mac 写的，最新一条就是它最后一次活着的时间
    const mac = (byAgent.macmini ||= { lastAt: null, lastMsg: null, lastStatus: null, stuck: [], count24h: 0, fail24h: 0, entries: [] });
    if (!mac.lastAt) Object.assign(mac, { lastAt: e.ts, lastMsg: e.msg, lastStatus: "ok" });
    if (Date.parse(e.ts) >= day) mac.count24h++;
    if (mac.entries.length < 150) mac.entries.push(e);
    if (e.source.includes("backtrace") || e.source.includes("ivy")) {
      const iv = (byAgent.inspector ||= { lastAt: null, lastMsg: null, lastStatus: null, stuck: [], count24h: 0, fail24h: 0, findings: [], entries: [] });
      if (e.task === "其他" && !iv.lastAt) Object.assign(iv, { lastAt: e.ts, lastMsg: e.msg, lastStatus: "ok" });
      if (e.status === "fail" && !e.resolved && Date.parse(e.ts) >= day) iv.findings!.push(e);
      if (iv.entries.length < 150) iv.entries.push(e);
    }
    // entries come newest first
    const who = agentForEntry(e);
    if (!who || who === "macmini") continue; // MAC 上面已经收了所有条目
    const s = (byAgent[who] ||= { lastAt: null, lastMsg: null, lastStatus: null, stuck: [], count24h: 0, fail24h: 0, entries: [] });
    if (!s.lastAt) Object.assign(s, { lastAt: e.ts, lastMsg: e.msg, lastStatus: e.resolved ? "ok" : e.status });
    if (s.entries.length < 150) s.entries.push(e);
    const t = Date.parse(e.ts);
    if (t >= day) {
      s.count24h++;
      if (e.status === "fail" && !e.resolved) s.fail24h++;
    }
    if (e.status === "run" || e.resolved) continue;
    const k = `${e.task}|${e.ip}|${e.platform}`;
    const m = (latestByKey[who] ||= {});
    if (!m[k]) m[k] = e;
  }
  for (const [who, m] of Object.entries(latestByKey)) {
    byAgent[who].stuck = Object.values(m).filter((e) => e.status === "fail" && Date.parse(e.ts) >= day);
  }

  return { ok: true, byAgent, human: humanTodos(r.data.entries) };
}

/** 悬停用的一句话：事情 + 卡在哪（原因太长就不放，点进工位看全文）。 */
export function stuckLine(e: AiEntry): string {
  const why = e.why && e.why.length <= 40 ? ` 原因：${e.why}` : "";
  return `${e.msg}${e.where ? `（卡在：${e.where}）` : ""}${why}`;
}
