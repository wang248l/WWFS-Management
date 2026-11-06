"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function KeyForm() {
  const router = useRouter();
  const [v, setV] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-wrap gap-2 mt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg("");
        const r = await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ MARKETING_API_KEY: v }) });
        const j = await r.json().catch(() => ({}));
        setBusy(false);
        if (!r.ok) return setMsg("❌ " + (j.error || "没存上"));
        setV("");
        setMsg(`✅ 已保存（${j.prefix}…），办公室现在能读到工作日志了`);
        router.refresh();
      }}
    >
      <input type="password" autoComplete="off" className="input flex-1 min-w-[18rem] font-mono" placeholder="粘贴 Marketing 的只读钥匙" value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn-primary" disabled={busy || !v.trim()}>
        {busy ? "检查中…" : "保存"}
      </button>
      {msg && <div className="w-full text-sm">{msg}</div>}
    </form>
  );
}
