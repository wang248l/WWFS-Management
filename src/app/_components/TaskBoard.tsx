"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TASK_COLUMNS } from "@/lib/officeConst";

export type BoardTask = { id: string; title: string; status: string; note: string | null; updatedAt: string; agent: { key: string; name: string; avatar: string | null } };
export type BoardAgent = { key: string; name: string; avatar: string | null };

/**
 * Agent 看板：待办 / 进行中 / 卡住 / 移交销售 / 完成。
 * 卡片底下的下拉直接换列；工位页传 fixedAgent 只看这一个人的卡。
 */
export default function TaskBoard({ tasks, agents, fixedAgent }: { tasks: BoardTask[]; agents: BoardAgent[]; fixedAgent?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [who, setWho] = useState(fixedAgent || agents[0]?.key || "");
  const [status, setStatus] = useState("todo");

  async function call(method: string, body: unknown) {
    setBusy(true);
    await fetch("/api/office/tasks", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          call("POST", { agent: who, title, status }).then(() => setTitle(""));
        }}
      >
        {!fixedAgent && (
          <select className="input w-auto" value={who} onChange={(e) => setWho(e.target.value)} aria-label="交给谁">
            {agents.map((a) => (
              <option key={a.key} value={a.key}>
                {a.avatar} {a.name}
              </option>
            ))}
          </select>
        )}
        <input className="input flex-1 min-w-[12rem]" placeholder="加一张卡：要做什么 / 哪个客户留了联系方式" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="放到哪一列">
          {TASK_COLUMNS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <button className="btn-primary" disabled={busy}>
          添加
        </button>
      </form>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
        {TASK_COLUMNS.map((col) => {
          const cards = tasks.filter((t) => t.status === col.key);
          return (
            <section key={col.key} className="rounded-xl bg-stone-100/70 border border-stone-200 p-2 min-h-[8rem]">
              <header className="flex items-center justify-between px-1 pb-2">
                <span className={"badge " + col.cls}>{col.label}</span>
                <span className="text-xs text-stone-500 tabular-nums">{cards.length}</span>
              </header>
              {col.key === "handoff" && <p className="px-1 pb-2 text-[11px] text-violet-700">→ 销售经理 Bob 跟进</p>}
              <div className="space-y-2">
                {cards.map((t) => (
                  <article key={t.id} className="card p-2.5 text-sm">
                    {!fixedAgent && (
                      <div className="text-xs text-stone-500 mb-1">
                        {t.agent.avatar} {t.agent.name}
                      </div>
                    )}
                    <div className="font-medium leading-snug">{t.title}</div>
                    {t.note && <div className="text-xs text-stone-500 mt-1">{t.note}</div>}
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        className="text-xs rounded border border-stone-300 bg-white px-1.5 py-1"
                        value={t.status}
                        disabled={busy}
                        aria-label="换列"
                        onChange={(e) => call("PATCH", { id: t.id, status: e.target.value })}
                      >
                        {TASK_COLUMNS.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="ml-auto text-xs text-stone-400 hover:text-red-600"
                        disabled={busy}
                        onClick={() => confirm("删除这张卡？") && call("DELETE", { id: t.id })}
                      >
                        删除
                      </button>
                    </div>
                  </article>
                ))}
                {!cards.length && <div className="text-xs text-stone-400 px-1">—</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
