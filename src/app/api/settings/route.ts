import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getJson } from "@/lib/team";

/**
 * POST /api/settings { MARKETING_API_KEY } —— 老板在 /settings 贴 Marketing 只读钥匙（登录态 + admin，middleware 管）。
 * 存之前先试一下能不能读到 AI 工作日志，读不到就不存。不回明文。
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const key = String(b?.MARKETING_API_KEY || "").trim();
  if (!/^[a-f0-9]{32,128}$/i.test(key)) return NextResponse.json({ error: "钥匙格式不对：应该是一长串字母数字" }, { status: 400 });
  const base = process.env.MARKETING_API_BASE || "https://marketing.wallacewang.ca";
  const r = await getJson<{ entries: unknown[] }>(`${base}/api/agent/ai-log?hours=1&limit=1`, { authorization: `Bearer ${key}` });
  if (!r.ok) return NextResponse.json({ error: `用这把钥匙读不到 Marketing 的工作日志（${r.error}）` }, { status: 400 });
  await db.setting.upsert({ where: { key: "MARKETING_API_KEY" }, update: { value: key }, create: { key: "MARKETING_API_KEY", value: key } });
  return NextResponse.json({ ok: true, prefix: key.slice(0, 8) });
}
