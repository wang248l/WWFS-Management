import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isTaskStatus } from "@/lib/office";

/** 看板卡片（登录态）：POST 新建 { agent, title, status? }，PATCH 改 { id, status?, title?, note? }，DELETE { id }。 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const title = String(b?.title || "").trim().slice(0, 200);
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const agent = await db.agent.findUnique({ where: { key: String(b?.agent || "") } });
  if (!agent) return NextResponse.json({ error: "no such agent" }, { status: 404 });
  const task = await db.agentTask.create({
    data: { agentId: agent.id, title, status: isTaskStatus(b?.status) ? b.status : "todo", note: b?.note ? String(b.note).slice(0, 500) : null },
  });
  return NextResponse.json({ ok: true, task });
}

export async function PATCH(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const data: Record<string, string | null> = {};
  if (b?.status !== undefined) {
    if (!isTaskStatus(b.status)) return NextResponse.json({ error: "bad status" }, { status: 400 });
    data.status = b.status;
  }
  if (b?.title) data.title = String(b.title).trim().slice(0, 200);
  if (b?.note !== undefined) data.note = b.note ? String(b.note).slice(0, 500) : null;
  const task = await db.agentTask.update({ where: { id: String(b?.id || "") }, data }).catch(() => null);
  if (!task) return NextResponse.json({ error: "no such task" }, { status: 404 });
  return NextResponse.json({ ok: true, task });
}

export async function DELETE(req: NextRequest) {
  const b = await req.json().catch(() => null);
  await db.agentTask.delete({ where: { id: String(b?.id || "") } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
