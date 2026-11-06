import { db } from "./db";

/** 环境变量优先，没有就用 /settings 页面存的值。 */
export async function setting(key: string): Promise<string | null> {
  if (process.env[key]) return process.env[key] as string;
  const row = await db.setting.findUnique({ where: { key } }).catch(() => null);
  return row?.value || null;
}
