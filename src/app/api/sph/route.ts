import { NextRequest, NextResponse } from "next/server";
import { getSph, normAccount, publicView } from "@/lib/sph";

export const dynamic = "force-dynamic";

/** 首页卡片轮询用（登录后的会话，middleware 已鉴权）。 */
export async function GET(req: NextRequest) {
  const account = normAccount(req.nextUrl.searchParams.get("account"));
  if (!account) return NextResponse.json({ error: "bad account" }, { status: 400 });
  return NextResponse.json(publicView(await getSph(account), account), { headers: { "cache-control": "no-store" } });
}
