import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentAuth, isTaskStatus } from "@/lib/office";

const KINDS = ["chat", "progress", "blocker", "meeting"];

/**
 * POST /api/agents/reply — agent 回老板（Bearer INGEST_TOKEN）。
 * {
 *   "agent": "mac",
 *   "text": "已把剪辑改成……" | "卡在：没有权限写 ~/autocut/xx",
 *   "kind": "chat | progress | blocker | meeting",   // blocker/meeting 会在办公室首页亮红灯，等老板点「已处理」
 *   "urgent": false,                                   // true = 随时找老板；false = 第二天开会
 *   "taskId": "…", "taskStatus": "doing|done|blocked", // 顺手挪看板上的卡
 *   "ack": ["<message id>"] | "all"                    // 这些留言标成已读
 * }
 */
export async function POST(req: NextRequest) {
  const err = agentAuth(req);
  if (err) return NextResponse.json({ error: err }, { status: err === "unauthorized" ? 401 : 503 });
  const b = await req.json().catch(() => null);
  const agent = await db.agent.findUnique({ where: { key: String(b?.agent || "") } });
  if (!agent) return NextResponse.json({ error: "no such agent" }, { status: 404 });
  const text = String(b?.text || "").trim().slice(0, 4000);
  const kind = KINDS.includes(b?.kind) ? b.kind : "chat";
  const taskId = b?.taskId ? String(b.taskId) : null;
  if (text) {
    await db.agentMessage.create({ data: { agentId: agent.id, fromRole: "agent", kind, urgent: !!b?.urgent, taskId, text } });
  }
  if (taskId && isTaskStatus(b?.taskStatus)) {
    await db.agentTask.updateMany({
      where: { id: taskId, agentId: agent.id },
      data: { status: b.taskStatus, ...(b.taskStatus === "blocked" && text ? { note: text.slice(0, 500) } : {}) },
    });
  }
  let acked = 0;
  if (b?.ack === "all" || Array.isArray(b?.ack)) {
    const where = { agentId: agent.id, fromRole: "owner", readAt: null, ...(Array.isArray(b.ack) ? { id: { in: b.ack.map(String) } } : {}) };
    acked = (await db.agentMessage.updateMany({ where, data: { readAt: new Date() } })).count;
  }
  return NextResponse.json({ ok: true, acked });
}
