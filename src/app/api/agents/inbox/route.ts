import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentAuth } from "@/lib/office";

/**
 * GET /api/agents/inbox?agent=mark — agent 值班时取老板在办公室里留给他的未读消息（Bearer INGEST_TOKEN）。
 * 不会自动标已读：办完用 POST /api/agents/reply 回复并带上 ack。
 */
export async function GET(req: NextRequest) {
  const err = agentAuth(req);
  if (err) return NextResponse.json({ error: err }, { status: err === "unauthorized" ? 401 : 503 });
  const agent = await db.agent.findUnique({ where: { key: req.nextUrl.searchParams.get("agent") || "" } });
  if (!agent) return NextResponse.json({ error: "no such agent" }, { status: 404 });
  const messages = await db.agentMessage.findMany({
    where: { agentId: agent.id, fromRole: "owner", readAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, text: true, createdAt: true },
  });
  return NextResponse.json({ agent: agent.key, messages });
}
