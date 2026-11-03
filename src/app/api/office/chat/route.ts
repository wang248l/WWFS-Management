import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { liveReply } from "@/lib/office";

/** POST /api/office/chat — 老板在工位上跟 agent 说话：{ agent: "mark", text: "…" }（登录态，middleware 管）。 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const text = String(b?.text || "").trim().slice(0, 4000);
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  const agent = await db.agent.findUnique({ where: { key: String(b?.agent || "") } });
  if (!agent) return NextResponse.json({ error: "no such agent" }, { status: 404 });

  await db.agentMessage.create({ data: { agentId: agent.id, fromRole: "owner", text } });
  const reply = await liveReply(agent.id);
  if (reply) await db.agentMessage.create({ data: { agentId: agent.id, fromRole: "agent", text: reply } });

  const messages = await db.agentMessage.findMany({ where: { agentId: agent.id }, orderBy: { createdAt: "asc" }, take: 200 });
  return NextResponse.json({ ok: true, live: !!reply, messages });
}
