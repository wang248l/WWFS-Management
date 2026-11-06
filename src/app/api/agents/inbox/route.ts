import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentAuth } from "@/lib/office";

/**
 * GET /api/agents/inbox?agent=mac — agent 取老板留给他的未读消息（Bearer INGEST_TOKEN）。
 * 每条带 kind（chat / instruction）和 taskId。不会自动标已读：用 POST /api/agents/reply 带 ack。
 */
export async function GET(req: NextRequest) {
  const err = await agentAuth(req);
  if (err) return NextResponse.json({ error: err }, { status: err === "unauthorized" ? 401 : 503 });
  const agent = await db.agent.findUnique({ where: { key: req.nextUrl.searchParams.get("agent") || "" } });
  if (!agent) return NextResponse.json({ error: "no such agent" }, { status: 404 });
  const messages = await db.agentMessage.findMany({
    where: { agentId: agent.id, fromRole: "owner", readAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, kind: true, text: true, taskId: true, createdAt: true },
  });
  return NextResponse.json({ agent: agent.key, messages });
}
