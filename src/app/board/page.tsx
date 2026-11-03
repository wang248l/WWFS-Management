import { db } from "@/lib/db";
import TaskBoard from "../_components/TaskBoard";

export const dynamic = "force-dynamic";

/** Agent 看板：所有人手上的事，一眼看完（2026-11-03 Wallace）。 */
export default async function BoardPage() {
  const [tasks, agents] = await Promise.all([
    db.agentTask.findMany({ orderBy: [{ order: "asc" }, { updatedAt: "desc" }], include: { agent: { select: { key: true, name: true, avatar: true } } } }),
    db.agent.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { key: true, name: true, avatar: true } }),
  ]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">📋 Agent 看板</h1>
        <p className="mt-1 text-sm text-stone-600">
          每张卡是一件事，由各个 agent 自己更新（只读）。宣发拿到联系方式的客户在「移交销售」，由销售经理 Bob 接手。
        </p>
      </div>
      <TaskBoard tasks={tasks.map((t) => ({ ...t, updatedAt: t.updatedAt.toISOString() }))} agents={agents} readOnly />
    </div>
  );
}
