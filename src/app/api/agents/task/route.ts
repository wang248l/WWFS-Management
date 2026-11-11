import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentAuth, isTaskStatus } from "@/lib/office";

/**
 * GET /api/agents/task?agent=mac — 列出这个人看板上的全部卡（Bearer agent 钥匙）。
 */
export async function GET(req: NextRequest) {
  const err = await agentAuth(req);
  if (err) return NextResponse.json({ error: err }, { status: err === "unauthorized" ? 401 : 503 });
  const agent = await db.agent.findUnique({ where: { key: req.nextUrl.searchParams.get("agent") || "" } });
  if (!agent) return NextResponse.json({ error: "no such agent" }, { status: 404 });
  const tasks = await db.agentTask.findMany({
    where: { agentId: agent.id },
    orderBy: [{ order: "asc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, status: true, note: true, order: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ agent: agent.key, tasks });
}

/**
 * DELETE /api/agents/task — 删掉这个人看板上的卡（Bearer agent 钥匙）。
 * { "agent": "mac", "ids": ["…"] } 按 id 删；或 { "agent": "mac", "titlePrefix": "队列 · " } 删掉这一组再重写（替换不追加）。
 * 只删属于这个 agent 的卡。2026-11-11 Wallace：看板要能整理，不要每次只加不删。
 */
export async function DELETE(req: NextRequest) {
  const err = await agentAuth(req);
  if (err) return NextResponse.json({ error: err }, { status: err === "unauthorized" ? 401 : 503 });
  const b = await req.json().catch(() => null);
  const agent = await db.agent.findUnique({ where: { key: String(b?.agent || "") } });
  if (!agent) return NextResponse.json({ error: "no such agent" }, { status: 404 });
  const ids: string[] = Array.isArray(b?.ids) ? b.ids.map(String).slice(0, 500) : [];
  const prefix = typeof b?.titlePrefix === "string" ? b.titlePrefix.trim() : "";
  if (!ids.length && prefix.length < 2) return NextResponse.json({ error: "ids or titlePrefix (2+ chars) required" }, { status: 400 });
  const r = await db.agentTask.deleteMany({
    where: { agentId: agent.id, ...(ids.length ? { id: { in: ids } } : { title: { startsWith: prefix } }) },
  });
  return NextResponse.json({ ok: true, deleted: r.count });
}

/**
 * POST /api/agents/task — agent 自己更新看板（Bearer INGEST_TOKEN）。
 * { "agent": "mark", "title": "每天三次值班", "status": "todo|doing|blocked|done", "note": "…", "id": "可选" }
 * 有 id 按 id 改；没有就按 (agent, title) 找，找不到新建。
 */
export async function POST(req: NextRequest) {
  const err = await agentAuth(req);
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
