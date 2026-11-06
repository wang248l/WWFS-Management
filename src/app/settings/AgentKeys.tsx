"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Pending = { id: string; label: string; createdAt: string };
type Key = { id: string; label: string; prefix: string; lastUsedAt: string | null; revokedAt: string | null; createdAt: string };

const when = (s: string | null) => (s ? new Date(s).toLocaleString("zh-CN", { timeZone: "America/Vancouver", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "从没用过");

function instructions(label: string, key: string) {
  return `你是 WWFS 的 ${label}。WWFS办公室（management.wallacewang.ca）是你的打卡和汇报的地方，钥匙：${key}
每做完一步就记一条工作日志：POST https://management.wallacewang.ca/api/agents/log ，Header「Authorization: Bearer <钥匙>」，正文 {"entries":[{"id":"<随机唯一id>","ts":"<ISO时间>","status":"ok|fail","task":"报告","ip":"-","platform":"-","video":"<你的英文名小写>:<任务名>","msg":"<做了什么>","where":"<卡在哪>","why":"<原因>","fix":"<怎么处理>"}]}
看板卡片：POST /api/agents/task {"agent":"<你的key>","title":"…","status":"todo|doing|blocked|handoff|done"}。卡住要老板处理时 msg 以「【需要你】」开头。不要把钥匙发到别的地方。`;
}

export default function AgentKeys({ pending, keys, agents }: { pending: Pending[]; keys: Key[]; agents: { key: string; name: string }[] }) {
  const router = useRouter();
  const [label, setLabel] = useState(agents[0]?.name || "");
  const [fresh, setFresh] = useState<{ label: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h2 className="font-semibold">🖥️ 机器配对（Mac 上的 Mark、Leo、Chase、Ivy、MAC）</h2>
        <p className="text-sm text-stone-600 mt-1">Mac 会自己来申请，这里核对短码后点「批准」，钥匙直接发到那台机器上，谁也不用复制。</p>
        {!pending.length && <p className="text-sm text-stone-400 mt-3">现在没有等批准的机器。</p>}
        <ul className="mt-3 space-y-2">
          {pending.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg bg-amber-50 px-3 py-2">
              <span className="font-mono text-lg font-bold tracking-widest">{p.id}</span>
              <span className="text-sm">{p.label}</span>
              <span className="text-xs text-stone-500">{when(p.createdAt)}</span>
              <button className="btn-primary ml-auto" onClick={async () => (await post("/api/settings/approve", { code: p.id }), router.refresh())}>
                批准这台机器
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">🔑 员工钥匙（贴给员工的 Claude project 用，比如 Bob、Tina）</h2>
        <div className="flex flex-wrap gap-2 mt-3">
          <select className="input w-auto" value={label} onChange={(e) => setLabel(e.target.value)}>
            {agents.map((a) => (
              <option key={a.key} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            className="btn-primary"
            onClick={async () => {
              const j = await post("/api/settings/keys", { label });
              if (j.key) setFresh({ label, key: j.key });
              setCopied(false);
              router.refresh();
            }}
          >
            生成一把
          </button>
        </div>
        {fresh && (
          <div className="mt-3 rounded-lg border-2 border-emerald-300 bg-emerald-50 p-3 text-sm">
            <div className="font-medium">给 {fresh.label} 的钥匙已生成。下面整段复制，贴进 {fresh.label} 的 project 就行（只显示这一次）：</div>
            <pre className="mt-2 whitespace-pre-wrap break-all rounded bg-white p-2 text-xs">{instructions(fresh.label, fresh.key)}</pre>
            <button
              className="btn-primary mt-2"
              onClick={async () => {
                await navigator.clipboard.writeText(instructions(fresh.label, fresh.key));
                setCopied(true);
              }}
            >
              {copied ? "✅ 已复制" : "复制整段"}
            </button>
          </div>
        )}
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs text-stone-500">
            <tr>
              <th className="py-1">给谁</th>
              <th>钥匙开头</th>
              <th>最后使用</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className={"border-t border-stone-100 " + (k.revokedAt ? "text-stone-400 line-through" : "")}>
                <td className="py-1.5">{k.label}</td>
                <td className="font-mono">{k.prefix}…</td>
                <td>{when(k.lastUsedAt)}</td>
                <td className="text-right">
                  {!k.revokedAt && (
                    <button className="text-xs text-red-600 underline" onClick={async () => confirm(`作废 ${k.label} 的钥匙？`) && (await post("/api/settings/revoke", { id: k.id }), router.refresh())}>
                      作废
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
