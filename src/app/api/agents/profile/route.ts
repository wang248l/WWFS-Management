import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentAuth } from "@/lib/office";

/**
 * POST /api/agents/profile — agent 改自己工位上的职责、头衔、标签（Bearer agent 钥匙）。
 * { "agent": "mac", "duty": "…", "title": "…", "tags": "发布,定时,巡检" }，没给的字段不动。
 * 2026-11-11 Wallace：Chase 是全部账号矩阵的发布负责人，职责要能直接更新。
 */
export async function POST(req: NextRequest) {
  const err = await agentAuth(req);
  if (err) return NextResponse.json({ error: err }, { status: err === "unauthorized" ? 401 : 503 });
  const b = await req.json().catch(() => null);
  const key = String(b?.agent || "");
  if (!(await db.agent.findUnique({ where: { key } }))) return NextResponse.json({ error: "no such agent" }, { status: 404 });
  const data: { duty?: string; title?: string; tags?: string } = {};
  for (const f of ["duty", "title", "tags"] as const) {
    if (typeof b?.[f] === "string") data[f] = b[f].trim().slice(0, f === "duty" ? 1000 : 200);
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "duty, title or tags required" }, { status: 400 });
  const agent = await db.agent.update({ where: { key }, data, select: { key: true, duty: true, title: true, tags: true } });
  return NextResponse.json({ ok: true, agent });
}
