"use client";

import { useEffect, useState } from "react";
import type { DevicesData } from "@/lib/devices";

const fmtWhen = (s: string | null) =>
  s ? new Date(s).toLocaleString("zh-CN", { timeZone: "America/Edmonton", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
const fmtAgo = (s: string) => {
  const sec = Math.max(0, Math.round((Date.now() - new Date(s).getTime()) / 1000));
  if (sec < 60) return `${sec} 秒前`;
  if (sec < 3600) return `${Math.round(sec / 60)} 分钟前`;
  if (sec < 86400) return `${Math.round(sec / 3600)} 小时前`;
  return `${Math.round(sec / 86400)} 天前`;
};
const OS: Record<string, string> = { darwin: "🍎 macOS", windows: "🪟 Windows", linux: "🐧 Linux" };
const STATUS: Record<string, [string, string]> = {
  queued: ["排队中", "bg-stone-100 text-stone-700"],
  running: ["正在做", "bg-blue-100 text-blue-800"],
  done: ["完成", "bg-emerald-100 text-emerald-800"],
  failed: ["失败", "bg-red-100 text-red-800"],
  cancelled: ["已取消", "bg-stone-100 text-stone-500"],
};
const MODES = [
  { v: "auto", label: "正常做（自动判断安全，危险操作会拒绝）" },
  { v: "plan", label: "只看不改（先出方案）" },
  { v: "acceptEdits", label: "只允许改文件" },
];
const phoneName = (data: DevicesData, serial: string) => data.phones.find((p) => p.serial === serial)?.name;

export default function DevicesView({ initial }: { initial: DevicesData }) {
  const [data, setData] = useState(initial);
  const [target, setTarget] = useState(initial.devices.find((d) => d.online)?.id || initial.devices[0]?.id || "");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [, tick] = useState(0);
  // 时间只在浏览器里算（服务器和浏览器时区/时刻不同会对不上）
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const when = (s: string | null) => (mounted ? fmtWhen(s) : "");
  const ago = (s: string) => (mounted ? fmtAgo(s) : "");

  const refresh = () =>
    fetch("/api/office/devices", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setData(j))
      .catch(() => {});
  useEffect(() => {
    const a = setInterval(refresh, 5000);
    const b = setInterval(() => tick((x) => x + 1), 1000);
    return () => (clearInterval(a), clearInterval(b));
  }, []);

  const post = (url: string, body: unknown) =>
    fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

  const send = async () => {
    setErr("");
    if (!target || !prompt.trim()) return setErr("先选电脑、写要做的事");
    setBusy(true);
    const j = await post("/api/office/devices/jobs", { deviceId: target, prompt, mode }).catch(() => ({ error: "网络不通" }));
    setBusy(false);
    if (j.error) return setErr(j.error);
    setPrompt("");
    setOpen(j.id);
    refresh();
  };

  const devName = (id: string) => data.devices.find((d) => d.id === id)?.name || id;

  return (
    <div className="space-y-5">
      {data.pending.length > 0 && (
        <section className="card border-amber-300 bg-amber-50 p-4">
          <h2 className="font-semibold">🔔 有电脑在申请加入</h2>
          <p className="mt-1 text-sm text-stone-600">核对一下那台电脑屏幕上显示的 6 位短码，一样就点批准。</p>
          <ul className="mt-2 space-y-2">
            {data.pending.map((p) => (
              <li key={p.code} className="flex items-center gap-3">
                <span className="font-mono text-lg font-bold tracking-widest">{p.code}</span>
                <span className="text-sm">{p.label}</span>
                <button className="btn-primary ml-auto" onClick={() => post("/api/settings/approve", { code: p.code }).then(refresh)}>
                  批准
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 电脑 */}
      <section className="grid gap-3 sm:grid-cols-2">
        {!data.devices.length && <div className="card p-5 text-sm text-stone-500">还没有电脑来报到。</div>}
        {data.devices.map((d) => {
          const phones = d.info.phones || [];
          const running = data.jobs.find((j) => j.deviceId === d.id && j.status === "running");
          return (
            <button
              key={d.id}
              onClick={() => setTarget(d.id)}
              className={
                "card p-4 text-left transition " + (target === d.id ? "ring-2 ring-brand-600" : "hover:shadow-md") + (d.online ? "" : " opacity-70")
              }
            >
              <div className="flex items-center gap-2">
                <span className={"inline-block h-2.5 w-2.5 rounded-full " + (d.online ? "bg-emerald-500 animate-pulse" : "bg-stone-400")} />
                <span className="font-semibold">{d.name}</span>
                <span className="text-xs text-stone-500">{OS[d.os] || d.os}</span>
                <span className={"ml-auto text-xs " + (d.online ? "text-emerald-700" : "text-stone-500")}>
                  {d.online ? "在线" : `离线 · 最后 ${ago(d.lastSeenAt)}`}
                </span>
              </div>
              <div className="mt-1 text-xs text-stone-500">
                {d.info.host || d.id}
                {d.info.claude ? ` · Claude ${d.info.claude}` : " · 没装 Claude"}
                {running ? " · 🔵 正在做任务" : ""}
              </div>
              {d.info.error && <div className="mt-1 text-xs text-red-700">⚠️ {d.info.error}</div>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {!phones.length && <span className="text-xs text-stone-400">没连手机</span>}
                {phones.map((p) => (
                  <span
                    key={p.serial}
                    className={"rounded-md px-2 py-0.5 text-xs " + (p.state === "device" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")}
                    title={p.serial}
                  >
                    📱 {phoneName(data, p.serial) || p.model || p.serial}
                    {p.state !== "device" ? `（${p.state === "unauthorized" ? "手机上没点允许" : p.state}）` : ""}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </section>

      {/* 手机 */}
      <section className="card p-4">
        <h2 className="font-semibold">📱 手机在哪台电脑上</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          {data.phones.map((p) => (
            <div key={p.serial} className={"rounded-lg px-3 py-2 text-sm " + (p.deviceId ? "bg-emerald-50" : "bg-stone-50")}>
              <div className="font-semibold">
                {p.name} <span className="text-xs font-normal text-stone-500">{p.note}</span>
              </div>
              <div className="font-mono text-[11px] text-stone-500">{p.serial}</div>
              <div className={"mt-1 text-xs " + (p.deviceId ? "text-emerald-800" : "text-stone-500")}>
                {p.deviceId ? `连在 ${p.deviceName}${p.state !== "device" ? `（${p.state}）` : ""}` : "没连在任何在线电脑上"}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 派任务 */}
      <section className="card p-4">
        <h2 className="font-semibold">🤖 让 Claude 在这台电脑上做事</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <select className="input w-auto" value={target} onChange={(e) => setTarget(e.target.value)}>
            {data.devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.online ? "" : "（离线，上线后再做）"}
              </option>
            ))}
          </select>
          <select className="input w-auto" value={mode} onChange={(e) => setMode(e.target.value)}>
            {MODES.map((m) => (
              <option key={m.v} value={m.v}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          className="input mt-2 h-28"
          placeholder="比如：看看连着的手机是不是都能用 adb 操作，P2 上小红书还登录着吗"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="mt-2 flex items-center gap-3">
          <button className="btn-primary" disabled={busy} onClick={send}>
            {busy ? "发送中…" : `交给 ${devName(target)}`}
          </button>
          {err && <span className="text-sm text-red-700">{err}</span>}
        </div>
      </section>

      {/* 任务记录 */}
      <section className="card p-4">
        <h2 className="font-semibold">📜 最近的任务</h2>
        {!data.jobs.length && <p className="mt-2 text-sm text-stone-400">还没派过任务。</p>}
        <ul className="mt-2 divide-y divide-stone-100">
          {data.jobs.map((j) => {
            const [label, cls] = STATUS[j.status] || [j.status, "bg-stone-100"];
            const isOpen = open === j.id;
            return (
              <li key={j.id} className="py-2">
                <div className="flex cursor-pointer items-start gap-2" onClick={() => setOpen(isOpen ? null : j.id)}>
                  <span className={"shrink-0 rounded px-2 py-0.5 text-xs " + cls}>{label}</span>
                  <span className="shrink-0 text-xs text-stone-500">{devName(j.deviceId)}</span>
                  <span className="line-clamp-1 flex-1 text-sm">{j.prompt}</span>
                  <span className="shrink-0 text-xs text-stone-400">{when(j.createdAt)}</span>
                </div>
                {isOpen && (
                  <div className="mt-2 space-y-2">
                    <div className="whitespace-pre-wrap rounded bg-stone-50 p-2 text-sm">{j.prompt}</div>
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-stone-900 p-3 text-xs text-stone-100">
                      {j.output || (j.status === "queued" ? "等那台电脑来领…" : j.status === "running" ? "正在做，还没有输出…" : "（没有输出）")}
                    </pre>
                    <div className="flex items-center gap-3 text-xs text-stone-500">
                      {j.startedAt && <span>开始 {when(j.startedAt)}</span>}
                      {j.finishedAt && <span>结束 {when(j.finishedAt)}</span>}
                      {j.exitCode !== null && <span>退出码 {j.exitCode}</span>}
                      {(j.status === "queued" || j.status === "running") && (
                        <button className="ml-auto rounded border border-stone-300 px-2 py-1 hover:bg-stone-100" onClick={() => post("/api/office/devices/cancel", { jobId: j.id }).then(refresh)}>
                          取消
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
