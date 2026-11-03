import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentAuth, isTaskStatus } from "@/lib/office";

/**
 * POST /api/agents/task — agent 自己更新看板（Bearer INGEST_TOKEN）。
 * { "agent": "mark", "title": "每天三次值班", "status": "todo|doing|blocked|done", "note": "…", "id": "可选" }
 * 有 id 按 id 改；没有就按 (agent, title) 找，找不到新建。
 */
export async function POST(req: NextRequest) {
  const err = agentAuth(req);
  if (err) return NextResponse.json({ error: err }, { status: err === "unauthorized" ? 401 : 503 });
  const b = await req.json().catch(() => null);
  const agent = await db.agent.findUnique({ where: { key: String(b?.agent || "") } });
  if (!agent) return NextResponse.json({ error: "no such agent" }, { status: 404 });
  const title = String(b?.title || "").trim().slice(0, 200);
  const status = isTaskStatus(b?.status) ? b.status : undefined;
  const note = b?.note === undefined ? undefined : b.note ? String(b.note).slice(0, 500) : null;
  const existing = b?.id
    ? await db.agentTask.findFirst({ where: { id: String(b.id), agentId: agent.id } })
    : title
      ? await db.agentTask.findFirst({ where: { agentId: agent.id, title } })
      : null;
  if (existing) {
    const task = await db.agentTask.update({ where: { id: existing.id }, data: { status, note, ...(title ? { title } : {}) } });
    return NextResponse.json({ ok: true, task });
  }
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const task = await db.agentTask.create({ data: { agentId: agent.id, title, status: status || "todo", note: note ?? null } });
  return NextResponse.json({ ok: true, task });
}
