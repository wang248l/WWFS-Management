import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentAuth } from "@/lib/office";

/**
 * POST /api/agents/reply — agent 回老板（Bearer INGEST_TOKEN）。
 * { "agent": "mark", "text": "已处理：…", "ack": ["<message id>", …] }  ack 里的留言标成已读；"ack": "all" = 全部已读。
 */
export async function POST(req: NextRequest) {
  const err = agentAuth(req);
  if (err) return NextResponse.json({ error: err }, { status: err === "unauthorized" ? 401 : 503 });
  const b = await req.json().catch(() => null);
  const agent = await db.agent.findUnique({ where: { key: String(b?.agent || "") } });
  if (!agent) return NextResponse.json({ error: "no such agent" }, { status: 404 });
  const text = String(b?.text || "").trim().slice(0, 4000);
  if (text) await db.agentMessage.create({ data: { agentId: agent.id, fromRole: "agent", text } });
  let acked = 0;
  if (b?.ack === "all" || Array.isArray(b?.ack)) {
    const where = { agentId: agent.id, fromRole: "owner", readAt: null, ...(Array.isArray(b.ack) ? { id: { in: b.ack.map(String) } } : {}) };
    acked = (await db.agentMessage.updateMany({ where, data: { readAt: new Date() } })).count;
  }
  return NextResponse.json({ ok: true, acked });
}
