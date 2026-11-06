import { createHash, randomBytes } from "crypto";
import { db } from "./db";

/** Mac 上的员工用的读写钥匙（2026-11-06）：明文只在配对时给机器一次，库里只存哈希。 */
export const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
export const mint = () => randomBytes(32).toString("hex");

/** 认钥匙：老的 INGEST_TOKEN 照旧能用；配对发的钥匙按哈希认，顺手记最后使用时间。 */
export async function agentKeyOk(req: Request): Promise<boolean> {
  const h = req.headers.get("authorization") || "";
  const t = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!t) return false;
  if (process.env.INGEST_TOKEN && t === process.env.INGEST_TOKEN) return true;
  const k = await db.agentKey.findUnique({ where: { tokenHash: sha(t) } }).catch(() => null);
  if (!k || k.revokedAt) return false;
  db.agentKey.update({ where: { id: k.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return true;
}
