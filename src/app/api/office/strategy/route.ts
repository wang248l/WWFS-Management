import { NextRequest, NextResponse } from "next/server";
import { saveAnswer } from "@/lib/strategy";

/** POST /api/office/strategy { week, id, done?, choice?, note? } —— 老板在战略页勾任务、拍板（登录态）。 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const week = String(b?.week || "");
  const id = String(b?.id || "").slice(0, 20);
  if (!/^\d{4}-W\d{2}$/.test(week) || !id) return NextResponse.json({ error: "week and id required" }, { status: 400 });
  const a: { done?: boolean; choice?: number; note?: string } = {};
  if (typeof b?.done === "boolean") a.done = b.done;
  if (typeof b?.choice === "number") a.choice = b.choice;
  if (typeof b?.note === "string") a.note = b.note.slice(0, 300);
  await saveAnswer(week, id, a);
  return NextResponse.json({ ok: true });
}
