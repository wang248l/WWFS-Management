import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/team — 名单页的增删改（session 鉴权由 middleware 管，只有 ALLOWED_ROLES 进得来）。
 * Body: { kind: "staff" | "agent", action: "save" | "delete", id?, data? }
 */
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);

export async function POST(req: NextRequest) {
  let b: any;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const { kind, action, id } = b || {};
  const d = b?.data || {};

  try {
    if (kind === "staff") {
      if (action === "delete") {
        await db.staff.delete({ where: { id } });
        return NextResponse.json({ ok: true });
      }
      const name = str(d.name);
      if (!name) return NextResponse.json({ error: "名字必填" }, { status: 400 });
      const data = {
        name,
        matchName: str(d.matchName),
        role: str(d.role),
        weeklyFilmMinutes: Math.max(0, Math.round(num(d.weeklyFilmMinutes, 0))),
        active: d.active !== false,
        order: Math.round(num(d.order, 0)),
      };
      const row = id ? await db.staff.update({ where: { id }, data }) : await db.staff.create({ data });
      return NextResponse.json({ ok: true, row });
    }
    if (kind === "agent") {
      if (action === "delete") {
        await db.agent.delete({ where: { id } });
        return NextResponse.json({ ok: true });
      }
      const name = str(d.name);
      const key = (str(d.key) || "").toLowerCase();
      if (!name || !/^[a-z0-9][a-z0-9_-]{0,39}$/.test(key)) {
        return NextResponse.json({ error: "名字必填；打卡名只能用小写字母、数字、- 和 _" }, { status: 400 });
      }
      const data = {
        key,
        name,
        duty: str(d.duty),
        host: str(d.host),
        schedule: str(d.schedule),
        everyHours: Math.max(0.1, num(d.everyHours, 24)),
        graceHours: Math.max(0, num(d.graceHours, 2)),
        tokenMatch: str(d.tokenMatch),
        active: d.active !== false,
        order: Math.round(num(d.order, 0)),
      };
      const row = id ? await db.agent.update({ where: { id }, data }) : await db.agent.create({ data });
      return NextResponse.json({ ok: true, row });
    }
  } catch (e: any) {
    const msg = e?.code === "P2002" ? "名字或打卡名重复了" : String(e?.message || e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ error: "unknown kind" }, { status: 400 });
}
