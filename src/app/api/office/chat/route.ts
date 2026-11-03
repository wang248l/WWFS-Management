import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { liveReply } from "@/lib/office";

/**
 * POST /api/office/chat — 老板在工位上跟 agent 说话（登录态，middleware 管）。
 * { agent: "mac", text: "…", kind: "chat" | "instruction" }
 * instruction = 交给他做：同时在他的看板上开一张「待办」卡，Mac 上的 runner 取走后执行，
 * 做完挪「完成」，卡住挪「卡住」并请求开会。
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const text = String(b?.text || "").trim().slice(0, 4000);
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  const agent = await db.agent.findUnique({ where: { key: String(b?.agent || "") } });
  if (!agent) return NextResponse.json({ error: "no such agent" }, { status: 404 });
  const kind = b?.kind === "instruction" ? "instruction" : "chat";

  let taskId: string | null = null;
  if (kind === "instruction") {
    const t = await db.agentTask.create({
      data: { agentId: agent.id, title: text.length > 60 ? text.slice(0, 60) + "…" : text, status: "todo", note: "老板交代" },
    });
    taskId = t.id;
  }
  await db.agentMessage.create({ data: { agentId: agent.id, fromRole: "owner", kind, text, taskId } });
  const reply = kind === "chat" ? await liveReply(agent.id) : null;
  if (reply) await db.agentMessage.create({ data: { agentId: agent.id, fromRole: "agent", text: reply } });

  const messages = await db.agentMessage.findMany({ where: { agentId: agent.id }, orderBy: { createdAt: "asc" }, take: 200 });
  return NextResponse.json({ ok: true, live: !!reply, messages });
}
