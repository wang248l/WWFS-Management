import { db } from "./db";

/** 已知的安卓手机（2026-11-21 Wallace 给的编号）。没在这里的序列号照样显示，只是没有名字。 */
export const KNOWN_PHONES: { serial: string; name: string; note: string }[] = [
  { serial: "H4K0220C04002100", name: "P0", note: "华为（国内平台）" },
  { serial: "RZGL52VFVJM", name: "P1", note: "Wallace 英文" },
  { serial: "RZGL52VG4XH", name: "P2", note: "Wallace 中文" },
  { serial: "R5GL33FFYGD", name: "P3", note: "Amelia" },
  { serial: "RZGL6285S2N", name: "P4", note: "" },
];

/** 已知电脑的显示名（agent 报上来的主机名 → 叫法）。WallaceHPLaptop 其实是 Surface Book。 */
export const KNOWN_HOSTS: Record<string, string> = {
  macmini: "Mac mini",
  wallacehplaptop: "Surface Book",
};

export const ONLINE_MS = 90_000; // 90 秒没报到就算离线（agent 每 30 秒报一次）
export const JOB_MODES = ["auto", "plan", "acceptEdits"] as const;

export type Phone = { serial: string; state: string; model?: string };
export type DeviceInfo = { phones?: Phone[]; claude?: string; agent?: string; cwd?: string; host?: string; error?: string };

export function parseInfo(s: string): DeviceInfo {
  try {
    return JSON.parse(s) || {};
  } catch {
    return {};
  }
}

export async function loadDevices() {
  const [devices, jobs, pending] = await Promise.all([
    db.device.findMany({ orderBy: { createdAt: "asc" } }),
    db.deviceJob.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    // 新电脑来配对（装小助手时会显示同一个 6 位短码），这里直接批准
    db.pairRequest.findMany({ where: { approvedAt: null, createdAt: { gte: new Date(Date.now() - 3600_000) } }, orderBy: { createdAt: "desc" } }),
  ]);
  const now = Date.now();
  const list = devices.map((d) => ({
    id: d.id,
    name: d.name,
    os: d.os,
    info: parseInfo(d.info),
    lastSeenAt: d.lastSeenAt.toISOString(),
    online: now - d.lastSeenAt.getTime() < ONLINE_MS,
  }));
  // 每部已知手机现在挂在哪台电脑上（只看在线的电脑）
  const phones = KNOWN_PHONES.map((p) => {
    const on = list.find((d) => d.online && (d.info.phones || []).some((x) => x.serial === p.serial));
    const st = on?.info.phones?.find((x) => x.serial === p.serial);
    return { ...p, deviceId: on?.id || null, deviceName: on?.name || null, state: st?.state || null, model: st?.model || null };
  });
  return {
    pending: pending.map((p) => ({ code: p.id, label: p.label, createdAt: p.createdAt.toISOString() })),
    devices: list,
    phones,
    jobs: jobs.map((j) => ({
      id: j.id,
      deviceId: j.deviceId,
      prompt: j.prompt,
      mode: j.mode,
      status: j.status,
      output: j.output,
      exitCode: j.exitCode,
      createdBy: j.createdBy,
      createdAt: j.createdAt.toISOString(),
      startedAt: j.startedAt?.toISOString() || null,
      finishedAt: j.finishedAt?.toISOString() || null,
    })),
  };
}
export type DevicesData = Awaited<ReturnType<typeof loadDevices>>;
