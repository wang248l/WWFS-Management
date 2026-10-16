"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Row = Record<string, any>;

type Field = { key: string; label: string; type?: "number" | "text" | "check"; placeholder?: string; wide?: boolean };

const STAFF_FIELDS: Field[] = [
  { key: "name", label: "名字", placeholder: "Amelia" },
  { key: "role", label: "岗位", placeholder: "出镜理财顾问" },
  { key: "matchName", label: "匹配名", placeholder: "空 = 用名字；CRM/Marketing 里的名字或邮箱片段" },
  { key: "weeklyFilmMinutes", label: "每周拍摄目标(分钟)", type: "number" },
  { key: "order", label: "排序", type: "number" },
  { key: "active", label: "在岗", type: "check" },
];

const AGENT_FIELDS: Field[] = [
  { key: "name", label: "名字", placeholder: "MAC" },
  { key: "key", label: "打卡名", placeholder: "mac" },
  { key: "duty", label: "职责", placeholder: "同步脚本到 Google Drive", wide: true },
  { key: "host", label: "机器", placeholder: "Mac mini" },
  { key: "schedule", label: "排程(人话)", placeholder: "每天 9:00" },
  { key: "everyHours", label: "多少小时跑一次", type: "number" },
  { key: "graceHours", label: "宽限(小时)", type: "number" },
  { key: "tokenMatch", label: "Marketing 钥匙名", placeholder: "mac" },
  { key: "order", label: "排序", type: "number" },
  { key: "active", label: "启用", type: "check" },
];

function Editor({ kind, title, fields, rows, blank }: { kind: "staff" | "agent"; title: string; fields: Field[]; rows: Row[]; blank: Row }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Row | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(body: Row) {
    setBusy(true);
    setErr("");
    const res = await fetch("/api/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(j.error || `出错了 (${res.status})`);
    setEditing(null);
    router.refresh();
  }

  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <button className="btn-primary" onClick={() => setEditing({ ...blank })}>+ 添加</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-stone-500">
            <tr>
              {fields.map((f) => (
                <th key={f.key} className="text-left px-2 py-1 font-medium whitespace-nowrap">{f.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((r) => (
              <tr key={r.id}>
                {fields.map((f) => (
                  <td key={f.key} className={"px-2 py-1.5 " + (f.wide ? "min-w-[16rem]" : "whitespace-nowrap")}>
                    {f.type === "check" ? (r[f.key] ? "✓" : "—") : r[f.key] ?? <span className="text-stone-300">—</span>}
                  </td>
                ))}
                <td className="px-2 py-1.5 whitespace-nowrap text-right">
                  <button className="text-brand-700 hover:underline mr-3" onClick={() => setEditing({ ...r })}>改</button>
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() => confirm(`删除 ${r.name}？${kind === "agent" ? "它的运行记录也会一起删掉。" : ""}`) && send({ kind, action: "delete", id: r.id })}
                  >
                    删
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="border-t border-stone-200 pt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {fields.map((f) => (
              <label key={f.key} className={"block " + (f.wide ? "sm:col-span-2 lg:col-span-3" : "")}>
                <span className="label">{f.label}</span>
                {f.type === "check" ? (
                  <input
                    type="checkbox"
                    className="ml-2 align-middle"
                    checked={editing[f.key] !== false}
                    onChange={(e) => setEditing({ ...editing, [f.key]: e.target.checked })}
                  />
                ) : (
                  <input
                    className="input mt-1"
                    type={f.type === "number" ? "number" : "text"}
                    step="any"
                    placeholder={f.placeholder}
                    value={editing[f.key] ?? ""}
                    onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                  />
                )}
              </label>
            ))}
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy} onClick={() => send({ kind, action: "save", id: editing.id, data: editing })}>
              {busy ? "保存中…" : "保存"}
            </button>
            <button className="btn-secondary" onClick={() => setEditing(null)}>取消</button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function TeamEditor({ staff, agents }: { staff: Row[]; agents: Row[] }) {
  return (
    <div className="space-y-6">
      <Editor kind="staff" title="员工" fields={STAFF_FIELDS} rows={staff} blank={{ weeklyFilmMinutes: 0, order: staff.length + 1, active: true }} />
      <Editor kind="agent" title="AI Agent" fields={AGENT_FIELDS} rows={agents} blank={{ everyHours: 24, graceHours: 2, order: agents.length + 1, active: true }} />
    </div>
  );
}
