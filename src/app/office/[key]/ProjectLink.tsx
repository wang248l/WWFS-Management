"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** 培训 project 链接：有就显示按钮，没有就是「待建」+ 一个填链接的小框。 */
export default function ProjectLink({ agentKey, name, url }: { agentKey: string; name: string; url: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(url || "");
  const [err, setErr] = useState("");
  if (!editing)
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="btn-primary">
            🎓 打开 {name} 的培训 project ↗
          </a>
        ) : (
          <span className="badge bg-amber-50 text-amber-700 px-3 py-1.5">🎓 培训 project 待建</span>
        )}
        <button type="button" className="text-xs text-brand-700 underline" onClick={() => setEditing(true)}>
          {url ? "换链接" : "填链接"}
        </button>
      </div>
    );
  return (
    <form
      className="flex gap-2 flex-wrap"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await fetch("/api/office/agent", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: agentKey, projectUrl: v }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return setErr(j.error || "没存上");
        setEditing(false);
        router.refresh();
      }}
    >
      <input className="input flex-1 min-w-[16rem]" placeholder="https://claude.ai/project/…" value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn-primary">保存</button>
      <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
        取消
      </button>
      {err && <span className="text-xs text-red-600 w-full">{err}</span>}
    </form>
  );
}
