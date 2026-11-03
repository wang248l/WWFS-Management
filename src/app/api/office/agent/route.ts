import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** PATCH /api/office/agent { key, projectUrl?, skills? } — 工位上改培训 project 链接 / skill 文件夹（登录态）。 */
export async function PATCH(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const data: Record<string, string | null> = {};
  if (b?.projectUrl !== undefined) {
    const u = String(b.projectUrl || "").trim();
    if (u && !/^https:\/\//.test(u)) return NextResponse.json({ error: "链接要以 https:// 开头" }, { status: 400 });
    data.projectUrl = u || null;
  }
  if (b?.skills !== undefined) data.skills = String(b.skills || "").trim() || null;
  const a = await db.agent.update({ where: { key: String(b?.key || "") }, data }).catch(() => null);
  if (!a) return NextResponse.json({ error: "no such agent" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
