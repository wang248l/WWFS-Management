import { loadDevices } from "@/lib/devices";
import DevicesView from "./DevicesView";

export const dynamic = "force-dynamic";

/** 设备（2026-11-21 Wallace）：所有电脑 + 上面连的安卓手机，在线状态；选一台让 Claude 在上面跑任务。 */
export default async function DevicesPage() {
  const data = await loadDevices();
  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">🖥️ 设备</h1>
        <p className="mt-1 text-sm text-stone-600">
          每台电脑上装一个小助手，每 30 秒来报到一次，顺便报告它看到的安卓手机。手机插到哪台电脑，这里就显示在哪台。选一台电脑写下要做的事，Claude 就在那台电脑上做，做完把结果传回来。
        </p>
      </div>
      <DevicesView initial={data} />
      <section className="card p-4 text-sm">
        <h2 className="font-semibold">➕ 加一台新电脑</h2>
        <p className="mt-1 text-stone-600">
          Windows：在那台电脑上打开 PowerShell，粘贴下面一行回车。它会自己装好需要的东西，屏幕上出现 6 位短码后，回这个页面点「批准」。最后如果弹出 Claude 登录，用浏览器登录一次。
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-stone-900 p-2 text-xs text-stone-100">irm https://management.wallacewang.ca/agent/install.ps1 | iex</pre>
        <p className="mt-3 text-stone-600">Mac：Claude 会帮你装（Mac mini 已经装好了）。</p>
      </section>
    </div>
  );
}
