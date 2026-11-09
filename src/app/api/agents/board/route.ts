import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentAuth } from "@/lib/office";

/**
 * POST /api/agents/board — agent 每天推一份自己的状态板（Bearer agent 钥匙），同名覆盖。
 * { "agent": "chase", "board": { "checked": "...", "rows": [...], "fixes": [...] } }
 * 2026-11-09 Wallace：账号是否通畅的清单，每天跑一次，显示在 Chase 的工作状态里。
 */
export async function POST(req: NextRequest) {
  const err = await agentAuth(req);
  if (err) return NextResponse.json({ error: err }, { status: err === "unauthorized" ? 401 : 503 });
  const b = await req.json().catch(() => null);
  const agentKey = String(b?.agent || "").trim().toLowerCase();
  if (!(await db.agent.findUnique({ where: { key: agentKey } }))) return NextResponse.json({ error: "no such agent" }, { status: 404 });
  if (!b?.board || typeof b.board !== "object") return NextResponse.json({ error: "board required" }, { status: 400 });
  const value = JSON.stringify(b.board);
  if (value.length > 200_000) return NextResponse.json({ error: "board too large" }, { status: 413 });
  const key = `board:${agentKey}`;
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  return NextResponse.json({ ok: true });
}
