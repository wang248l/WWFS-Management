import { db } from "@/lib/db";
import { loadAiLog } from "@/lib/aiLog";
import KeyForm from "./KeyForm";
import AgentKeys from "./AgentKeys";

export const dynamic = "force-dynamic";

/** 设置（2026-11-06）：办公室读 AI 工作日志用的 Marketing 只读钥匙。 */
export default async function SettingsPage() {
  const row = await db.setting.findUnique({ where: { key: "MARKETING_API_KEY" } }).catch(() => null);
  const fromEnv = !!process.env.MARKETING_API_KEY;
  const ai = await loadAiLog();
  const [pending, keys, agents] = await Promise.all([
    db.pairRequest.findMany({ where: { approvedAt: null, createdAt: { gte: new Date(Date.now() - 3600_000) } }, orderBy: { createdAt: "desc" } }),
    db.agentKey.findMany({ orderBy: { createdAt: "desc" } }),
    db.agent.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { key: true, name: true } }),
  ]);
  const n = Object.values(ai.byAgent).reduce((k, v) => k + v.entries.length, 0);
  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-2xl font-semibold">⚙️ 设置</h1>
      <AgentKeys
        pending={pending.map((p) => ({ id: p.id, label: p.label, createdAt: p.createdAt.toISOString() }))}
        keys={keys.map((k) => ({ id: k.id, label: k.label, prefix: k.prefix, lastUsedAt: k.lastUsedAt?.toISOString() || null, revokedAt: k.revokedAt?.toISOString() || null, createdAt: k.createdAt.toISOString() }))}
        agents={agents}
      />
      <section className="card p-5">
        <h2 className="font-semibold">AI 工作日志连接（Mac 配对以后就不需要 Marketing 钥匙了）</h2>
        <p className="text-sm text-stone-600 mt-1">
          办公室里每个人的「工作日志」「卡住了」「上次运行」都是从 Marketing 网站读 Mac 的 AI 工作日志。要一把 Marketing 的<strong>只读</strong>钥匙。
        </p>
        <div className={"mt-3 rounded-lg px-3 py-2 text-sm " + (ai.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")}>
          {ai.ok
            ? `✅ 已连接：读到最近 48 小时 ${n} 条记录（钥匙来自${fromEnv ? "服务器环境变量" : "这个页面"}）`
            : row || fromEnv
              ? "❌ 有钥匙但读不到：钥匙可能被撤销了，重新贴一把"
              : "❌ 还没配钥匙，所以办公室里看不到任何人的工作记录"}
        </div>
        {!fromEnv && (
          <>
            <ol className="text-sm text-stone-700 mt-4 list-decimal pl-5 space-y-1">
              <li>
                打开 Marketing 网站的{" "}
                <a href="https://marketing.wallacewang.ca/tokens" target="_blank" rel="noreferrer" className="text-brand-700 underline">
                  钥匙页面
                </a>
                ，新建一把，名字写「WWFS办公室」，权限选<strong>只读</strong>。
              </li>
              <li>点复制，回到这里粘贴、保存。保存前会先试一下能不能读到。</li>
            </ol>
            <KeyForm />
          </>
        )}
      </section>
    </div>
  );
}
