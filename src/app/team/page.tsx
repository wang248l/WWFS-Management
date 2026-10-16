import { db } from "@/lib/db";
import TeamEditor from "./TeamEditor";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const [staff, agents] = await Promise.all([
    db.staff.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] }),
    db.agent.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">👥 人员与 Agent 名单</h1>
        <p className="mt-1 text-sm text-stone-600">
          每日仪表盘只盯这里登记的人和 agent。加新 agent：在下面加一行，或者让 agent 跑完直接打卡，第一次打卡会自动登记。
        </p>
      </div>
      <TeamEditor
        staff={staff.map((s) => ({ ...s, createdAt: undefined, updatedAt: undefined }))}
        agents={agents.map((a) => ({ ...a, createdAt: undefined, updatedAt: undefined }))}
      />
      <div className="card p-4 text-sm space-y-2">
        <div className="font-medium">Agent 怎么打卡</div>
        <p className="text-stone-600">每次跑完调用一次（INGEST_TOKEN 跟月底数据上传是同一把）：</p>
        <pre className="bg-stone-900 text-stone-100 rounded-md p-3 text-xs overflow-x-auto">{`curl -X POST https://management.wallacewang.ca/api/agents/run \\
  -H "Authorization: Bearer $INGEST_TOKEN" -H "Content-Type: application/json" \\
  -d '{"agent":"mac","task":"同步脚本到 Google Drive","status":"ok","summary":"Amelia 3 条、Ishan 2 条","outputCount":5}'`}</pre>
        <p className="text-stone-500 text-xs">
          填了「Marketing 钥匙名」的 agent 不打卡也能看到：它用 Marketing API 的最后时间也算一次活动。
        </p>
      </div>
    </div>
  );
}
