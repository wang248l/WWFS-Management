import { NextResponse } from "next/server";
import { loadDevices } from "@/lib/devices";

export const dynamic = "force-dynamic";

/** GET /api/office/devices（登录态）—— 设备页每几秒刷新一次用。 */
export async function GET() {
  return NextResponse.json(await loadDevices());
}
