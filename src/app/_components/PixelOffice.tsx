"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 像素办公室（2026-11-03 Wallace：「我要在首页看到所有员工的脸，可以做成像素风格的，真的画一个办公室出来，
 * 然后这些员工坐在里面办公」——参考 GBA 时代的俯视角像素游戏风格，人物和场景都是自己画的）。
 *
 * 一张 SVG：每个部门一间房，墙、窗、地板、桌子、电脑、绿植；每个人一个 12×14 的像素小人。
 * 状态直接画在头上：在岗敲键盘，未上岗打瞌睡（Zzz），找你 / 出错头顶红色「!」，有未读留言冒对话泡。
 * 鼠标放上去：头顶出现选择箭头，下面的对话框打字机式显示他在干什么；点一下进工位。
 * 桌面 3×2 间房，手机 2×3 间房（两张 SVG，按屏宽显示一张）。
 */

export type PixelPerson = {
  key: string;
  name: string;
  title: string;
  tags: string | null;
  href: string;
  external?: boolean;
  mood: "work" | "sleep" | "alert" | "happy";
  statusLabel: string;
  task: string | null;
  unread: number;
  shared?: boolean; // 共用一张桌一台电脑
  schedule?: string | null; // 定时任务：每天 07:35 / 12:35 / 17:35
  every?: string | null; // 周期：每 8 小时一次
  lastRun?: string | null; // 上次跑：3 小时前（打卡内容）
  host?: string | null;
  stuck?: string | null; // 头上「!」的原因
  seat?: boolean; // 空位（招聘中）
  device?: boolean; // 设备本身是一个角色（MAC：Mark 和 Chase 共用的电脑）
};
export type PixelRoom = { name: string; people: PixelPerson[] };

// ---- 像素小人 -------------------------------------------------------------
// O 描边 H 头发 S 皮肤 E 眼睛 B 腮红 M 嘴 C 衣服 D 衣服暗部 G 眼镜 .透明
const FACE_SHORT = [
  "..OOOOOOOO..",
  ".OHHHHHHHHO.",
  "OHHHHHHHHHHO",
  "OHHSSSSSSHHO",
  "OHSSSSSSSSHO",
  "OSSESSSSESSO",
  "OSSESSSSESSO",
  "OSBSSSSSSBSO",
  ".OSSSMMSSSO.",
  "..OOSSSSOO..",
];
const FACE_LONG = [
  "..OOOOOOOO..",
  ".OHHHHHHHHO.",
  "OHHHHHHHHHHO",
  "OHHSSSSSSHHO",
  "OHSSSSSSSSHO",
  "OHSESSSSESHO",
  "OHSESSSSESHO",
  "OHBSSSSSSBHO",
  "OHHSSMMSSHHO",
  "OHHOSSSSOHHO",
];
const FACE_SPIKY = [
  ".O.OO.OO.O..",
  "OHOHHOHHOHO.",
  "OHHHHHHHHHHO",
  "OHHSSSSSSHHO",
  "OHSSSSSSSSHO",
  "OSSESSSSESSO",
  "OSSESSSSESSO",
  "OSBSSSSSSBSO",
  ".OSSSMMSSSO.",
  "..OOSSSSOO..",
];
const FACE_BUN = [
  "....OOOO....",
  "..OOHHHHOO..",
  ".OHHHHHHHHO.",
  "OHHSSSSSSHHO",
  "OHSSSSSSSSHO",
  "OSSESSSSESSO",
  "OSSESSSSESSO",
  "OSBSSSSSSBSO",
  ".OSSSMMSSSO.",
  "..OOSSSSOO..",
];
// 2026-11-03 Wallace 要「冒险游戏男女主角」和「农场游戏主人公」的感觉——这里是同类风格的原创造型，不照搬任何游戏角色。
// K 帽子 Y 帽檐/背带 R 帽带 W 帽徽
const FACE_CAP = [
  "..OOOOOOOO..",
  ".OKKKKKKKKO.",
  "OKKKKWWKKKKO",
  "OYYYYYYYYYYO",
  "OHSSSSSSSSHO",
  "OSSESSSSESSO",
  "OSSESSSSESSO",
  "OSBSSSSSSBSO",
  ".OSSSMMSSSO.",
  "..OOSSSSOO..",
];
const FACE_BERET = [
  "...OOOOOO...",
  "..OKKKKKKOO.",
  ".OKKKKKKKKKO",
  "OHHHHHHHHHHO",
  "OHSSSSSSSSHO",
  "OHSESSSSESHO",
  "OHSESSSSESHO",
  "OHBSSSSSSBHO",
  "OHHSSMMSSHHO",
  "OHHOSSSSOHHO",
];
const FACE_STRAW = [
  "...OOOOOO...",
  "..OKKKKKKO..",
  "..ORRRRRRO..",
  "OKKKKKKKKKKO",
  "OHSSSSSSSSHO",
  "OSSESSSSESSO",
  "OSSESSSSESSO",
  "OSBSSSSSSBSO",
  ".OSSSMMSSSO.",
  "..OOSSSSOO..",
];
const BODY_PACK = [".OCCCCCCCCO.", "OCYCCCCCCYCO", "OCYCCCCCCYCO"];
const BODY_OVERALLS = [".OCCCCCCCCO.", "OCDDCCCCDDCO", "OCDDDDDDDDCO"];
const BODY = [".OCCCCCCCCO.", "OCCCDCCDCCCO", "OCCCCCCCCCCO"];
const HANDS_A = ["OSSCCCCCCSSO"];
const HANDS_B = ["OCCSSCCSSCCO"];

type Look = { hair: string; skin: string; shirt: string; dark: string; face: string[]; glasses?: boolean; body?: string[]; extra?: Record<string, string> };
const LOOKS: Record<string, Look> = {
  // 社媒运营部：冒险少年（Mark）+ 冒险少女（Chase）
  mark: { hair: "#2b2b3a", skin: "#f6c9a4", shirt: "#2f7fd0", dark: "#235e9c", face: FACE_CAP, body: BODY_PACK, extra: { K: "#1fa37a", Y: "#f2c230", W: "#ffffff" } },
  mac: { hair: "#c2542f", skin: "#f8d2b4", shirt: "#f2f2f2", dark: "#d0d0d8", face: FACE_BERET, body: BODY_PACK, extra: { K: "#e0457b", Y: "#6b5bd6" } },
  // 市场部：草帽农场主（Leo）
  leo: { hair: "#8a5a2b", skin: "#f6cfa8", shirt: "#e8574a", dark: "#3d6fb8", face: FACE_STRAW, body: BODY_OVERALLS, extra: { K: "#f2cf6b", R: "#d9452f" } },
  recruit: { hair: "#1f1f2a", skin: "#f4c7a2", shirt: "#16a394", dark: "#0f766e", face: FACE_BUN },
  // 销售经理 Bob：西装领带；会计 Tina：眼镜 + 发髻
  bob: { hair: "#4a3424", skin: "#f1c29c", shirt: "#2f3a5c", dark: "#d9452f", face: FACE_SHORT, body: [".OCCCWWCCCO.", "OCCCWDDWCCCO", "OCCCCDDCCCCO"], extra: { W: "#ffffff" } },
  tina: { hair: "#2a1a14", skin: "#f8d5b8", shirt: "#4c9a6a", dark: "#357350", face: FACE_BUN, glasses: true },
  // 检查员 Ivy：格子侦探帽 + 驼色风衣（原创）
  inspector: { hair: "#5a3a22", skin: "#f8d5b8", shirt: "#c69a5b", dark: "#8f6a38", face: FACE_CAP, body: [".OCCCCCCCCO.", "OCDCCCCCCDCO", "OCDCCCCCCDCO"], extra: { K: "#7a5c3a", Y: "#5c4329", W: "#c9a66b" } },
  ryzen: { hair: "#555a66", skin: "#eebf98", shirt: "#64748b", dark: "#46505f", face: FACE_SHORT },
  amelia: { hair: "#3a2418", skin: "#f8d2b4", shirt: "#ec5f9e", dark: "#be3d77", face: FACE_LONG },
  ishan: { hair: "#15151c", skin: "#b9805a", shirt: "#2f9e57", dark: "#21763f", face: FACE_SHORT },
};
const FALLBACK = ["#e05d5d", "#4fa3e0", "#9fc94f", "#e0a84f", "#7a6fe0"];
function lookFor(key: string): Look {
  const k = key.toLowerCase();
  if (LOOKS[k]) return LOOKS[k];
  const h = [...k].reduce((n, c) => n + c.charCodeAt(0), 0);
  const c = FALLBACK[h % FALLBACK.length];
  return { hair: "#3a2a20", skin: "#f3c6a0", shirt: c, dark: c, face: h % 2 ? FACE_LONG : FACE_SHORT };
}

const P = 2; // 一个像素 = 2 个 SVG 单位

function Pixels({ rows, pal, x, y, className }: { rows: string[]; pal: Record<string, string>; x: number; y: number; className?: string }) {
  const rects: JSX.Element[] = [];
  rows.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      const ch = row[c];
      if (ch === "." || !pal[ch]) {
        c++;
        continue;
      }
      let run = 1;
      while (row[c + run] === ch) run++;
      rects.push(<rect key={`${r}-${c}`} x={x + c * P} y={y + r * P} width={run * P} height={P} fill={pal[ch]} />);
      c += run;
    }
  });
  return <g className={className}>{rects}</g>;
}

function Person({ p, x, y }: { p: PixelPerson; x: number; y: number }) {
  const L = lookFor(p.key === "mac" ? "mac" : p.key);
  const pal: Record<string, string> = { O: "#2a1e1a", H: L.hair, S: L.skin, E: "#1a1420", B: "#f29a9a", M: "#b5525a", C: L.shirt, D: L.dark, ...(L.extra || {}) };
  const face = p.mood === "sleep" ? L.face.map((r, i) => (i === 5 ? r.replace(/E/g, "S") : i === 6 ? r.replace(/E/g, "E") : r)) : L.face;
  const happyMouth = p.mood === "happy";
  return (
    <g className={"px-bob " + (p.mood === "sleep" ? "px-slow" : "")}>
      <Pixels rows={face} pal={pal} x={x} y={y} />
      {L.glasses && (
        <g fill="none" stroke="#1a1420" strokeWidth={1}>
          <rect x={x + 2.5 * P} y={y + 4.5 * P} width={3 * P} height={2.6 * P} />
          <rect x={x + 6.5 * P} y={y + 4.5 * P} width={3 * P} height={2.6 * P} />
        </g>
      )}
      {happyMouth && <rect x={x + 4 * P} y={y + 8 * P} width={4 * P} height={P} fill="#b5525a" />}
      {/* 眨眼：皮肤色盖住眼睛，偶尔闪一下 */}
      {p.mood !== "sleep" && (
        <g className="px-blink" fill={L.skin}>
          <rect x={x + 3 * P} y={y + 5 * P} width={P} height={2 * P} />
          <rect x={x + 8 * P} y={y + 5 * P} width={P} height={2 * P} />
        </g>
      )}
      <Pixels rows={L.body || BODY} pal={pal} x={x} y={y + 10 * P} />
      {p.mood === "work" || p.mood === "happy" ? (
        <>
          <Pixels rows={HANDS_A} pal={pal} x={x} y={y + 13 * P} className="px-frame-a" />
          <Pixels rows={HANDS_B} pal={pal} x={x} y={y + 13 * P} className="px-frame-b" />
        </>
      ) : (
        <Pixels rows={HANDS_A} pal={pal} x={x} y={y + 13 * P} />
      )}
    </g>
  );
}

// ---- 家具 ----------------------------------------------------------------
function Desk({ x, y, w, on, imac, bare }: { x: number; y: number; w: number; on: boolean; imac?: boolean; bare?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={14} fill="#8a5a33" />
      <rect x={x} y={y} width={w} height={3} fill="#b07a48" />
      <rect x={x} y={y + 14} width={w} height={2} fill="#5e3b20" />
      <rect x={x + 2} y={y + 16} width={3} height={6} fill="#5e3b20" />
      <rect x={x + w - 5} y={y + 16} width={3} height={6} fill="#5e3b20" />
      {bare ? null : imac ? (
        <g>
          <rect x={x + w / 2 - 13} y={y - 20} width={26} height={18} fill="#d8d8de" />
          <rect x={x + w / 2 - 11} y={y - 18} width={22} height={13} fill={on ? "#7fc3ff" : "#3d3d4a"} className={on ? "px-screen" : ""} />
          <rect x={x + w / 2 - 3} y={y - 2} width={6} height={3} fill="#b9b9c2" />
          <rect x={x + w / 2 - 1} y={y - 15} width={2} height={2} fill="#ffffff" opacity={on ? 0.8 : 0.2} />
        </g>
      ) : (
        // 一个人的桌：显示器放左边，不挡脸和手
        <g>
          <rect x={x + 2} y={y - 14} width={20} height={14} fill="#2d2d3a" />
          <rect x={x + 4} y={y - 12} width={16} height={9} fill={on ? "#8fe08a" : "#3d3d4a"} className={on ? "px-screen" : ""} />
          <rect x={x + 10} y={y} width={4} height={2} fill="#2d2d3a" />
        </g>
      )}
      <rect x={x + w - 8} y={y - 5} width={5} height={6} fill="#f2f2f2" />
      <rect x={x + w - 8} y={y - 5} width={5} height={2} fill="#6b3f1f" />
    </g>
  );
}
function Chair({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={20} height={16} fill="#8a6a50" />
      <rect x={x + 2} y={y + 2} width={16} height={11} fill="#a8876a" />
    </g>
  );
}
function Plant({ x, y }: { x: number; y: number }) {
  return (
    <g className="px-sway">
      <rect x={x + 3} y={y + 12} width={10} height={8} fill="#b4552d" />
      <rect x={x + 3} y={y + 12} width={10} height={2} fill="#d16b3d" />
      <rect x={x + 6} y={y} width={4} height={12} fill="#2e8b45" />
      <rect x={x} y={y + 3} width={6} height={4} fill="#3fae5a" />
      <rect x={x + 10} y={y + 1} width={6} height={4} fill="#3fae5a" />
      <rect x={x + 4} y={y - 3} width={8} height={4} fill="#57c46f" />
    </g>
  );
}
function Shelf({ x, y }: { x: number; y: number }) {
  const books = ["#d94f4f", "#4f7fd9", "#e0b84f", "#5fae6a", "#9a5fd9", "#e07f4f"];
  return (
    <g>
      <rect x={x} y={y} width={28} height={22} fill="#6b4426" />
      <rect x={x + 2} y={y + 2} width={24} height={8} fill="#3e2716" />
      <rect x={x + 2} y={y + 12} width={24} height={8} fill="#3e2716" />
      {books.map((c, i) => (
        <rect key={i} x={x + 3 + i * 4} y={y + (i % 2 ? 3 : 4)} width={3} height={i % 2 ? 7 : 6} fill={c} />
      ))}
      {books.slice(0, 4).map((c, i) => (
        <rect key={"b" + i} x={x + 4 + i * 5} y={y + 13} width={4} height={7} fill={c} />
      ))}
    </g>
  );
}
function Camera({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x + 6} y={y} width={14} height={10} fill="#2d2d3a" />
      <rect x={x + 2} y={y + 3} width={5} height={5} fill="#5a5a6e" />
      <rect x={x + 16} y={y + 2} width={2} height={2} fill="#ff4d4d" className="px-rec" />
      <rect x={x + 12} y={y + 10} width={2} height={14} fill="#55555f" />
      <rect x={x + 6} y={y + 22} width={14} height={2} fill="#55555f" />
      <circle cx={x + 36} cy={y + 6} r={7} fill="none" stroke="#fff6c8" strokeWidth={3} />
      <rect x={x + 35} y={y + 13} width={2} height={11} fill="#55555f" />
    </g>
  );
}
function Board({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <rect x={x} y={y} width={40} height={20} fill="#f6f1e1" stroke="#6b4426" strokeWidth={2} />
      <text x={x + 20} y={y + 13} textAnchor="middle" fontSize={8} fill="#c0392b" className="px-font">
        {label}
      </text>
    </g>
  );
}


// ---- 农场（市场部）：田、菜苗、栅栏、小鸡、向日葵、草垛、水壶，全是原创像素 ----
function Crop({ x, y, kind, delay }: { x: number; y: number; kind: number; delay: number }) {
  const leaf = kind === 2 ? "#5fbf4a" : "#3fae5a";
  return (
    <g className="px-sway" style={{ animationDelay: `${delay}s` }}>
      {kind === 0 && (
        <>
          <rect x={x + 3} y={y + 1} width={2} height={5} fill={leaf} />
          <rect x={x} y={y + 2} width={3} height={2} fill={leaf} />
          <rect x={x + 5} y={y + 1} width={3} height={2} fill={leaf} />
        </>
      )}
      {kind === 1 && (
        <>
          <rect x={x + 2} y={y + 5} width={5} height={4} fill="#f0f0f0" />
          <rect x={x + 3} y={y + 8} width={3} height={2} fill="#c86b9a" />
          <rect x={x + 3} y={y} width={1} height={5} fill={leaf} />
          <rect x={x + 5} y={y + 1} width={1} height={4} fill={leaf} />
        </>
      )}
      {kind === 2 && (
        <>
          <rect x={x + 3} y={y + 4} width={3} height={6} fill="#f08a24" />
          <rect x={x + 2} y={y} width={2} height={4} fill={leaf} />
          <rect x={x + 5} y={y} width={2} height={4} fill={leaf} />
        </>
      )}
    </g>
  );
}
function FarmPlot({ x, y }: { x: number; y: number }) {
  const cells = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++) {
      cells.push(<rect key={`s${r}${c}`} x={x + c * 12} y={y + r * 12} width={11} height={11} fill={(r + c) % 2 ? "#7a4e2c" : "#6b4426"} />);
      cells.push(<rect key={`l${r}${c}`} x={x + c * 12} y={y + r * 12 + 9} width={11} height={2} fill="#553519" />);
      cells.push(<Crop key={`c${r}${c}`} x={x + c * 12 + 1} y={y + r * 12} kind={(r * 4 + c) % 3} delay={((r + c) % 3) * 0.4} />);
    }
  return <g>{cells}</g>;
}
function Fence({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <rect x={x} y={y + 4} width={n * 10} height={2} fill="#c9a06a" />
      <rect x={x} y={y + 9} width={n * 10} height={2} fill="#c9a06a" />
      {[...Array(n + 1)].map((_, i) => (
        <g key={i}>
          <rect x={x + i * 10 - 1} y={y} width={3} height={14} fill="#e2bd86" />
          <rect x={x + i * 10 - 1} y={y + 12} width={3} height={2} fill="#9c7444" />
        </g>
      ))}
    </g>
  );
}
function Chicken({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g className="px-chick-walk" style={{ ["--run" as any]: `${w}px` }}>
      <g className="px-chick-flip">
        <rect x={x} y={y + 3} width={8} height={6} fill="#ffffff" />
        <rect x={x + 6} y={y} width={5} height={5} fill="#ffffff" />
        <rect x={x + 7} y={y - 2} width={3} height={2} fill="#e5383b" />
        <rect x={x + 11} y={y + 2} width={2} height={1} fill="#f2a62b" />
        <rect x={x + 9} y={y + 1} width={1} height={1} fill="#2a1e1a" />
        <rect x={x - 1} y={y + 3} width={2} height={3} fill="#e8e8e8" />
        <rect x={x + 2} y={y + 9} width={1} height={2} fill="#f2a62b" className="px-frame-a" />
        <rect x={x + 5} y={y + 9} width={1} height={2} fill="#f2a62b" className="px-frame-b" />
      </g>
    </g>
  );
}
function Sunflower({ x, y }: { x: number; y: number }) {
  return (
    <g className="px-sway">
      <rect x={x + 4} y={y + 8} width={2} height={14} fill="#3fae5a" />
      <rect x={x + 6} y={y + 14} width={4} height={2} fill="#3fae5a" />
      <rect x={x} y={y} width={10} height={10} fill="#f7c531" />
      <rect x={x + 2} y={y - 2} width={6} height={14} fill="#f7c531" />
      <rect x={x - 2} y={y + 2} width={14} height={6} fill="#f7c531" />
      <rect x={x + 2} y={y + 2} width={6} height={6} fill="#7a4a1c" />
    </g>
  );
}
function HayBale({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={26} height={16} fill="#e8c35a" />
      <rect x={x} y={y} width={26} height={3} fill="#f5d77d" />
      <rect x={x + 7} y={y} width={2} height={16} fill="#b38a2e" />
      <rect x={x + 17} y={y} width={2} height={16} fill="#b38a2e" />
      <rect x={x + 3} y={y + 7} width={4} height={1} fill="#c9a540" />
      <rect x={x + 20} y={y + 10} width={4} height={1} fill="#c9a540" />
    </g>
  );
}
function WateringCan({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y + 3} width={10} height={8} fill="#5b9bd5" />
      <rect x={x + 10} y={y + 4} width={6} height={2} fill="#5b9bd5" />
      <rect x={x + 15} y={y + 2} width={3} height={3} fill="#4a86bd" />
      <rect x={x + 2} y={y} width={6} height={2} fill="#4a86bd" />
      <rect x={x + 1} y={y + 5} width={8} height={1} fill="#8fc0ec" />
    </g>
  );
}


function ChartBoard({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={38} height={26} fill="#fffdf4" stroke="#55555f" strokeWidth={2} />
      <rect x={x + 5} y={y + 16} width={5} height={6} fill="#4f7fd9" />
      <rect x={x + 13} y={y + 12} width={5} height={10} fill="#4f7fd9" />
      <rect x={x + 21} y={y + 8} width={5} height={14} fill="#4f7fd9" />
      <rect x={x + 29} y={y + 4} width={5} height={18} fill="#2f9e57" className="px-blinkon-slow" />
      <rect x={x + 17} y={y + 26} width={2} height={8} fill="#55555f" />
    </g>
  );
}
function Cabinet({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={22} height={28} fill="#8c96a6" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={x + 2} y={y + 2 + i * 9} width={18} height={7} fill="#a9b2c0" />
          <rect x={x + 8} y={y + 4 + i * 9} width={6} height={2} fill="#55555f" />
        </g>
      ))}
      <rect x={x + 26} y={y + 14} width={12} height={14} fill="#3d3d4a" />
      <rect x={x + 28} y={y + 16} width={8} height={3} fill="#9fe08a" />
      <rect x={x + 28} y={y + 21} width={2} height={2} fill="#d0d0d8" />
      <rect x={x + 31} y={y + 21} width={2} height={2} fill="#d0d0d8" />
      <rect x={x + 34} y={y + 21} width={2} height={2} fill="#f2a62b" />
      <rect x={x + 28} y={y + 24} width={2} height={2} fill="#d0d0d8" />
      <rect x={x + 31} y={y + 24} width={2} height={2} fill="#d0d0d8" />
    </g>
  );
}
function MeetingTable({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={x + 10 + i * 34} y={y - 12} width={16} height={10} fill="#a8876a" />
          <rect x={x + 10 + i * 34} y={y + 34} width={16} height={10} fill="#a8876a" />
        </g>
      ))}
      <rect x={x} y={y} width={112} height={30} fill="#8a5a33" />
      <rect x={x} y={y} width={112} height={3} fill="#b07a48" />
      <rect x={x + 20} y={y + 10} width={10} height={8} fill="#f6f1e1" />
      <rect x={x + 80} y={y + 12} width={8} height={6} fill="#f2f2f2" />
      <text x={x + 56} y={y + 21} textAnchor="middle" fontSize={8} fill="#fff8e7" className="px-font">
        开会请到这里
      </text>
    </g>
  );
}


// ---- 社媒运营部 = 拍摄工作室（2026-11-05 Wallace：「市场运营的办公室换一下风格，加入打光灯，摄像机，手机支架这样的元素，
// 然后 MAC 设备要单独成为一个角色」）。全是原创像素。----
function Softbox({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x} ${y}h22l-4 16h-14z`} fill="#2d2d3a" />
      <rect x={x + 3} y={y + 2} width={16} height={11} fill="#fff6d6" className="px-screen" />
      <rect x={x + 10} y={y + 16} width={2} height={22} fill="#55555f" />
      <path d={`M${x + 4} ${y + 40}l7 -4l7 4`} stroke="#55555f" strokeWidth={2} fill="none" />
    </g>
  );
}
function PhoneTripod({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={9} height={15} rx={1} fill="#1f1f28" />
      <rect x={x + 1} y={y + 1} width={7} height={12} fill="#7fc3ff" className="px-screen" />
      <rect x={x + 6} y={y + 2} width={1} height={1} fill="#ff4d4d" className="px-rec" />
      <rect x={x + 4} y={y + 15} width={2} height={18} fill="#55555f" />
      <path d={`M${x - 1} ${y + 36}l6 -4l6 4`} stroke="#55555f" strokeWidth={2} fill="none" />
      <circle cx={x + 4.5} cy={y + 7} r={11} fill="none" stroke="#fff6c8" strokeWidth={2} opacity={0.9} />
    </g>
  );
}
function OnAir({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={22} height={10} rx={2} fill="#3a1a1a" />
      <text x={x + 11} y={y + 7.5} textAnchor="middle" fontSize={6} fill="#ff5a5a" className="px-font px-rec" fontWeight={700}>
        ● REC
      </text>
    </g>
  );
}
/** MAC：Mark 和 Chase 共用的那台电脑，自己是一个角色——屏幕就是它的脸。 */
function MacFace({ x, y, mood }: { x: number; y: number; mood: PixelPerson["mood"] }) {
  const screen = mood === "alert" ? "#ff8a8a" : mood === "sleep" ? "#3d3d4a" : "#7fc3ff";
  return (
    <g className="px-bob">
      <rect x={x} y={y} width={30} height={22} fill="#d8d8de" />
      <rect x={x + 2} y={y + 2} width={26} height={16} fill={screen} className={mood === "sleep" ? "" : "px-screen"} />
      {mood === "sleep" ? (
        <g fill="#9a9aa8">
          <rect x={x + 8} y={y + 9} width={4} height={1} />
          <rect x={x + 18} y={y + 9} width={4} height={1} />
        </g>
      ) : (
        <g fill="#1a1420">
          <rect x={x + 9} y={y + 7} width={3} height={4} />
          <rect x={x + 18} y={y + 7} width={3} height={4} />
          <g className="px-blink" fill={screen}>
            <rect x={x + 9} y={y + 7} width={3} height={4} />
            <rect x={x + 18} y={y + 7} width={3} height={4} />
          </g>
        </g>
      )}
      <rect x={x + (mood === "alert" ? 13 : 12)} y={y + 13} width={mood === "alert" ? 4 : 6} height={mood === "alert" ? 3 : 1} fill="#1a1420" />
      <rect x={x + 12} y={y + 22} width={6} height={3} fill="#b9b9c2" />
      <rect x={x + 9} y={y + 25} width={12} height={2} fill="#b9b9c2" />
    </g>
  );
}


function Pantry({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {/* 咖啡机 */}
      <rect x={x} y={y + 6} width={30} height={10} fill="#8a5a33" />
      <rect x={x + 4} y={y - 14} width={16} height={20} fill="#3d3d4a" />
      <rect x={x + 7} y={y - 10} width={10} height={4} fill="#9fe08a" className="px-screen" />
      <rect x={x + 9} y={y} width={6} height={6} fill="#fffdf4" />
      <rect x={x + 10} y={y - 4} width={1} height={3} fill="#e8e8e8" className="px-zzz" />
      {/* 沙发 */}
      <rect x={x + 60} y={y + 4} width={56} height={12} fill="#d4704f" />
      <rect x={x + 60} y={y - 6} width={56} height={10} fill="#e08a6a" />
      <rect x={x + 56} y={y - 2} width={6} height={18} fill="#b85a3a" />
      <rect x={x + 114} y={y - 2} width={6} height={18} fill="#b85a3a" />
      {/* 小桌 + 杯子 */}
      <rect x={x + 76} y={y + 26} width={26} height={10} fill="#8a5a33" />
      <rect x={x + 84} y={y + 21} width={5} height={6} fill="#fffdf4" />
    </g>
  );
}

const ROOM_FLOOR: Record<string, [string, string]> = {
  社媒运营部: ["#d7e8f7", "#c9def2"],
  市场部: ["#8fd16a", "#82c75e"], // 草地
  "剪辑 · 检查区": ["#8fd16a", "#82c75e"],
  社媒运营区: ["#d7e8f7", "#c9def2"],
  增员部: ["#d4f0ea", "#c3e8e0"],
  内容部: ["#e6dcf5", "#dacdf0"],
  出镜顾问: ["#f8dce8", "#f2cddd"],
  销售部: ["#e4dff7", "#d8d1f2"],
  财务部: ["#f3eedb", "#ebe4cb"],
  会议室: ["#e9e4dc", "#dfd8cd"],
  茶水间: ["#efe6d2", "#e6dbc3"],
};

const TILE = 16;
const ROOM_W = 12 * TILE; // 192
const ROOM_H = 9 * TILE; // 144
const HALL = 2 * TILE;

function Room({ room, x, y, onHover, onLeave }: { room: PixelRoom; x: number; y: number; onHover: (p: PixelPerson) => void; onLeave: () => void }) {
  const router = useRouter();
  const [f1, f2] = ROOM_FLOOR[room.name] || ["#ece6dc", "#e2dacd"];
  const farm = room.name === "市场部" || room.name === "剪辑 · 检查区";
  const studio = room.name === "社媒运营部" || room.name === "社媒运营区";
  const macDev = room.people.find((p) => p.device);
  const tiles: JSX.Element[] = [];
  for (let ty = 2; ty < 9; ty++)
    for (let tx = 0; tx < 12; tx++)
      tiles.push(<rect key={`${tx}-${ty}`} x={x + tx * TILE} y={y + ty * TILE} width={TILE} height={TILE} fill={(tx + ty) % 2 ? f1 : f2} />);

  // 座位：共用的两个人一张长桌一台 iMac，其他人各一张桌
  const shared = room.people.filter((p) => p.shared && !p.device);
  const solo = room.people.filter((p) => !p.shared && !p.device);
  type Slot = { people: PixelPerson[]; w: number };
  const slots: Slot[] = [];
  if (shared.length >= 2) slots.push({ people: shared, w: 110 });
  else solo.unshift(...shared);
  for (const p of solo) slots.push({ people: [p], w: 60 });
  const totalW = slots.reduce((n, s) => n + s.w, 0) + (slots.length - 1) * 8;
  let cx = x + Math.max(8, (ROOM_W - totalW) / 2);
  const deskY = y + 4 * TILE + 26;

  return (
    <g>
      {tiles}
      {/* 墙 + 窗 + 钟 */}
      <rect x={x} y={y} width={ROOM_W} height={2 * TILE} fill={farm ? "#b5473a" : "#a77c5a"} />
      {farm && [...Array(12)].map((_, i) => <rect key={"pl" + i} x={x + i * 16} y={y} width={1} height={2 * TILE} fill="#8f3329" />)}
      <rect x={x} y={y + 2 * TILE - 4} width={ROOM_W} height={4} fill={farm ? "#f3efe6" : "#7b573b"} />
      <rect x={x + 20} y={y + 6} width={30} height={18} fill="#9fd6ff" stroke="#f3efe6" strokeWidth={2} />
      <rect x={x + 34} y={y + 6} width={2} height={18} fill="#f3efe6" />
      <rect x={x + 22} y={y + 8} width={8} height={3} fill="#ffffff" opacity={0.7} className="px-cloud" />
      <circle cx={x + ROOM_W - 26} cy={y + 15} r={7} fill="#f3efe6" stroke="#5e3b20" strokeWidth={2} />
      <rect x={x + ROOM_W - 27} y={y + 10} width={2} height={6} fill="#5e3b20" />
      <rect x={x + ROOM_W - 27} y={y + 14} width={5} height={2} fill="#5e3b20" className="px-hand" />
      {/* 房间名牌 */}
      <rect x={x + 60} y={y + 6} width={72} height={16} fill="#3a2a20" />
      <rect x={x + 62} y={y + 8} width={68} height={12} fill="#fff8e7" />
      <text x={x + 96} y={y + 17.5} textAnchor="middle" fontSize={9} fill="#3a2a20" className="px-font" fontWeight={700}>
        {room.name}
      </text>
      {/* 边框墙 */}
      <rect x={x} y={y} width={ROOM_W} height={ROOM_H} fill="none" stroke="#5e3b20" strokeWidth={3} />
      {/* 门 */}
      <rect x={x + ROOM_W / 2 - 12} y={y + ROOM_H - 3} width={24} height={4} fill={f1} />

      {/* 装饰 */}
      {studio && (
        <g>
          <OnAir x={x + 136} y={y + 9} />
          <Softbox x={x + 6} y={y + 40} />
          <Softbox x={x + ROOM_W - 30} y={y + 40} />
          <PhoneTripod x={x + 12} y={y + ROOM_H - 40} />
          <Camera x={x + ROOM_W - 52} y={y + ROOM_H - 30} />
        </g>
      )}
      {studio ? null : farm ? (
        <g>
          <FarmPlot x={x + 8} y={y + 40} />
          <WateringCan x={x + 14} y={y + 80} />
          <Fence x={x + 136} y={y + 38} n={5} />
          <Sunflower x={x + 140} y={y + 58} />
          <Sunflower x={x + 172} y={y + 62} />
          <HayBale x={x + ROOM_W - 34} y={y + ROOM_H - 22} />
          <Chicken x={x + 10} y={y + ROOM_H - 18} w={44} />
          <Chicken x={x + 140} y={y + 100} w={30} />
        </g>
      ) : (
        <>
          <Plant x={x + 6} y={y + ROOM_H - 26} />
          {room.name === "出镜顾问" ? (
            <Camera x={x + ROOM_W - 52} y={y + ROOM_H - 30} />
          ) : room.name === "销售部" ? (
            <ChartBoard x={x + ROOM_W - 46} y={y + ROOM_H - 40} />
          ) : room.name === "财务部" ? (
            <Cabinet x={x + ROOM_W - 44} y={y + ROOM_H - 32} />
          ) : room.name === "茶水间" ? (
            <Pantry x={x + 30} y={y + 62} />
          ) : room.name === "会议室" ? (
            <MeetingTable x={x + 40} y={y + 62} />
          ) : (
            <Shelf x={x + ROOM_W - 34} y={y + ROOM_H - 28} />
          )}
        </>
      )}

      {slots.map((s, si) => {
        const sx = cx;
        cx += s.w + 8;
        const seat = s.people[0]?.seat;
        if (seat) {
          const p = s.people[0];
          return (
            <g key={si} className="px-person cursor-pointer" onClick={() => router.push(p.href)} onMouseEnter={() => onHover(p)} onMouseLeave={onLeave}>
              <Chair x={sx + 16} y={deskY - 22} />
              <Desk x={sx} y={deskY} w={s.w} on={false} />
              <Board x={sx + 6} y={deskY - 50} label="招聘中" />
              <PixelLabel x={sx + s.w / 2} y={deskY + 34} text={p.name} />
            </g>
          );
        }
        const on = s.people.some((p) => p.mood === "work" || p.mood === "happy");
        const n = s.people.length;
        return (
          <g key={si}>
            {s.people.map((p, pi) => (
              <Chair key={"c" + p.key} x={sx + (s.w / n) * pi + s.w / n / 2 - 10 + (n === 1 ? 8 : 0)} y={deskY - 22} />
            ))}
            {s.people.map((p, pi) => {
              const px = sx + (s.w / n) * pi + s.w / n / 2 - 12 + (n === 1 ? 8 : 0);
              const py = deskY - 30;
              return (
                <g
                  key={p.key}
                  className="px-person cursor-pointer"
                  onClick={() => (p.external ? window.open(p.href, "_blank") : router.push(p.href))}
                  onMouseEnter={() => onHover(p)}
                  onMouseLeave={onLeave}
                >
                  <rect x={px - 6} y={py - 18} width={36} height={70} fill="transparent" />
                  <Person p={p} x={px} y={py} />
                  <Bubble p={p} x={px + 12} y={py - 6} />
                  <g className="px-cursor">
                    <path d={`M${px + 7} ${py - 22}h10l-5 6z`} fill="#ffdf3d" stroke="#2a1e1a" strokeWidth={1} />
                  </g>
                  <PixelLabel x={px + 12} y={deskY + 34} text={p.name} />
                </g>
              );
            })}
            <Desk x={sx} y={deskY} w={s.w} on={on} imac={n > 1 && !macDev} bare={n > 1 && !!macDev} />
            {n > 1 && macDev && (
              // 共用的那台 MAC 自己是一个角色：坐在两个人中间的桌上
              <g
                className="px-person cursor-pointer"
                onClick={() => router.push(macDev.href)}
                onMouseEnter={() => onHover(macDev)}
                onMouseLeave={onLeave}
              >
                <MacFace x={sx + s.w / 2 - 15} y={deskY - 26} mood={macDev.mood} />
                <Bubble p={macDev} x={sx + s.w / 2 + 2} y={deskY - 30} />
                <g className="px-cursor">
                  <path d={`M${sx + s.w / 2 - 5} ${deskY - 40}h10l-5 6z`} fill="#ffdf3d" stroke="#2a1e1a" strokeWidth={1} />
                </g>
                <PixelLabel x={sx + s.w / 2} y={deskY + 12} text="MAC" />
              </g>
            )}
            {n > 1 && !macDev && (
              <text x={sx + s.w / 2} y={deskY + 11} textAnchor="middle" fontSize={6} fill="#fff8e7" className="px-font">
                共用一台 Mac
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

function PixelLabel({ x, y, text }: { x: number; y: number; text: string }) {
  const w = Math.max(28, [...text].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 9 : 5.2), 0) + 8);
  return (
    <g>
      <rect x={x - w / 2} y={y - 9} width={w} height={12} fill="#2a1e1a" />
      <rect x={x - w / 2 + 1} y={y - 8} width={w - 2} height={10} fill="#fffdf4" />
      <text x={x} y={y} textAnchor="middle" fontSize={8} fill="#2a1e1a" className="px-font" fontWeight={700}>
        {text}
      </text>
    </g>
  );
}

function Bubble({ p, x, y }: { p: PixelPerson; x: number; y: number }) {
  if (p.mood === "alert")
    return (
      <g className="px-bang">
        <rect x={x + 8} y={y - 14} width={10} height={13} fill="#fff" stroke="#2a1e1a" strokeWidth={1.5} />
        <rect x={x + 12} y={y - 12} width={2} height={6} fill="#e5383b" />
        <rect x={x + 12} y={y - 4} width={2} height={2} fill="#e5383b" />
      </g>
    );
  if (p.mood === "sleep")
    return (
      <g className="px-zzz" fill="#5b5b7a" fontSize={8} fontWeight={700}>
        <text x={x + 10} y={y - 2} className="px-font">
          z
        </text>
        <text x={x + 15} y={y - 9} fontSize={6} className="px-font">
          z
        </text>
      </g>
    );
  if (p.unread > 0)
    return (
      <g className="px-bang">
        <rect x={x + 8} y={y - 14} width={14} height={11} fill="#fff" stroke="#2a1e1a" strokeWidth={1.5} />
        <rect x={x + 10} y={y - 3} width={3} height={3} fill="#fff" stroke="#2a1e1a" strokeWidth={1} />
        <text x={x + 15} y={y - 5.5} textAnchor="middle" fontSize={7} fill="#3b6fe0" className="px-font" fontWeight={700}>
          {p.unread}
        </text>
      </g>
    );
  if (p.mood === "happy")
    return (
      <g className="px-twinkle" fill="#ffd23d">
        <rect x={x + 10} y={y - 10} width={2} height={6} />
        <rect x={x + 8} y={y - 8} width={6} height={2} />
      </g>
    );
  return null;
}

function Hall({ x, y, w }: { x: number; y: number; w: number }) {
  const tiles: JSX.Element[] = [];
  for (let tx = 0; tx < w / TILE; tx++)
    for (let ty = 0; ty < 2; ty++) tiles.push(<rect key={`${tx}-${ty}`} x={x + tx * TILE} y={y + ty * TILE} width={TILE} height={TILE} fill={(tx + ty) % 2 ? "#cfc6b6" : "#c4baa8"} />);
  return (
    <g>
      {tiles}
      <rect x={x} y={y + 14} width={w} height={4} fill="#b9ae99" />
      {/* 办公室的猫：在走廊里走来走去 */}
      <g className="px-cat-walk" style={{ ["--hall" as any]: `${w - 30}px` }}>
        <g className="px-cat-flip">
          <rect x={x + 4} y={y + 12} width={14} height={8} fill="#f0a64a" />
          <rect x={x + 14} y={y + 8} width={8} height={8} fill="#f0a64a" />
          <rect x={x + 14} y={y + 6} width={2} height={3} fill="#f0a64a" />
          <rect x={x + 20} y={y + 6} width={2} height={3} fill="#f0a64a" />
          <rect x={x + 16} y={y + 11} width={1} height={1} fill="#2a1e1a" />
          <rect x={x + 19} y={y + 11} width={1} height={1} fill="#2a1e1a" />
          <rect x={x} y={y + 10} width={5} height={2} fill="#f0a64a" />
          <rect x={x + 6} y={y + 20} width={2} height={3} fill="#c97f2e" className="px-frame-a" />
          <rect x={x + 14} y={y + 20} width={2} height={3} fill="#c97f2e" className="px-frame-b" />
          <rect x={x + 9} y={y + 13} width={6} height={2} fill="#d98a35" />
        </g>
      </g>
      {/* 饮水机 */}
      <rect x={x + w - 22} y={y + 2} width={12} height={26} fill="#e8eef5" stroke="#8090a0" strokeWidth={1} />
      <rect x={x + w - 20} y={y - 6} width={8} height={9} fill="#8fd0ff" />
    </g>
  );
}


// ---- Claude 巡视员（2026-11-03 Wallace：「把 Claude 的小人也加进去，到处走然后做一个巡视的动作，
// 鼠标点小人就显示，需要发布指令就到 Claude」）。原创造型：陶土色兜帽 + 记录板，不用任何官方标志。----
const CLAUDE_SPRITE = [
  "..OOOOOOOO..",
  ".OKKKKKKKKO.",
  "OKKKKKKKKKKO",
  "OKKSSSSSSKKO",
  "OKSSSSSSSSKO",
  "OSSESSSSESSO",
  "OSSESSSSESSO",
  "OSBSSSSSSBSO",
  ".OSSSMMSSSO.",
  "..OOSSSSOO..",
  ".OKKKKKKKKO.",
  "OKKKKKWWWWKO",
  "OKKKKKWLLWKO",
  "OSKKKKWWWWSO",
];
const CLAUDE_PAL = { O: "#2a1e1a", K: "#d4704f", S: "#fbe3cf", E: "#1a1420", B: "#f2a08a", M: "#a8483a", W: "#fffdf4", L: "#8a8a99" };

function ClaudePatrol({ x, y, w, onClick }: { x: number; y: number; w: number; onClick: () => void }) {
  return (
    <g className="px-claude-walk cursor-pointer" style={{ ["--hall" as any]: `${w - 40}px` }} onClick={onClick}>
      <rect x={x} y={y - 14} width={30} height={50} fill="transparent" />
      <g className="px-claude-flip">
        <g className="px-bob">
          <Pixels rows={CLAUDE_SPRITE} pal={CLAUDE_PAL} x={x + 4} y={y - 12} />
          <rect x={x + 7} y={y + 16} width={4} height={4} fill="#2a1e1a" className="px-frame-a" />
          <rect x={x + 17} y={y + 16} width={4} height={4} fill="#2a1e1a" className="px-frame-b" />
          <rect x={x + 7} y={y + 16} width={4} height={2} fill="#2a1e1a" className="px-frame-b" />
          <rect x={x + 17} y={y + 16} width={4} height={2} fill="#2a1e1a" className="px-frame-a" />
        </g>
      </g>
      {/* 巡视：停下来的时候头上冒「✓」 */}
      <g className="px-claude-check">
        <rect x={x + 18} y={y - 30} width={14} height={13} fill="#fff" stroke="#2a1e1a" strokeWidth={1.5} />
        <path d={`M${x + 21} ${y - 24}l3 3l5 -6`} stroke="#2f9e57" strokeWidth={2} fill="none" />
      </g>
      <PixelLabel x={x + 16} y={y + 30} text="Claude" />
    </g>
  );
}


// ---- 市场部单独一间大办公室（2026-11-05 Wallace：「Marketing 的办公室要稍微大一点……设置 Claude 在办公，然后市场部办公室隐藏，
// 显示一个箭头，点一下就进入市场部办公室，要求逐渐变成黑屏，再从黑屏渐显的动画」）。地图上原来市场部的格子 = Claude 的办公室 + 一扇门。----
const BIG_ROOM = "市场部";

function ClaudeOffice({ x, y, inside, onEnter, onClaude }: { x: number; y: number; inside: PixelRoom; onEnter: () => void; onClaude: () => void }) {
  const tiles: JSX.Element[] = [];
  for (let ty = 2; ty < 9; ty++)
    for (let tx = 0; tx < 12; tx++)
      tiles.push(<rect key={`${tx}-${ty}`} x={x + tx * TILE} y={y + ty * TILE} width={TILE} height={TILE} fill={(tx + ty) % 2 ? "#f6e3d6" : "#efd6c6"} />);
  const alert = inside.people.some((p) => p.mood === "alert");
  const deskY = y + 4 * TILE + 26;
  return (
    <g>
      {tiles}
      <rect x={x} y={y} width={ROOM_W} height={2 * TILE} fill="#b86a4b" />
      <rect x={x} y={y + 2 * TILE - 4} width={ROOM_W} height={4} fill="#8a4a33" />
      <rect x={x + 20} y={y + 6} width={30} height={18} fill="#9fd6ff" stroke="#f3efe6" strokeWidth={2} />
      <rect x={x + 34} y={y + 6} width={2} height={18} fill="#f3efe6" />
      <rect x={x + 60} y={y + 6} width={72} height={16} fill="#3a2a20" />
      <rect x={x + 62} y={y + 8} width={68} height={12} fill="#fff8e7" />
      <text x={x + 96} y={y + 17.5} textAnchor="middle" fontSize={9} fill="#3a2a20" className="px-font" fontWeight={700}>
        Claude 办公室
      </text>
      <rect x={x} y={y} width={ROOM_W} height={ROOM_H} fill="none" stroke="#5e3b20" strokeWidth={3} />
      <Plant x={x + 6} y={y + ROOM_H - 26} />

      {/* Claude 坐在桌前办公（点它 = 去 Claude 发布指令） */}
      <g className="px-person cursor-pointer" onClick={onClaude}>
        <Chair x={x + 36} y={deskY - 22} />
        <g className="px-bob">
          <Pixels rows={CLAUDE_SPRITE.slice(0, 11)} pal={CLAUDE_PAL} x={x + 34} y={deskY - 30} />
          <Pixels rows={["OSKKKKKKKKSO"]} pal={CLAUDE_PAL} x={x + 34} y={deskY - 8} className="px-frame-a" />
          <Pixels rows={["OKKSSKKSSKKO"]} pal={CLAUDE_PAL} x={x + 34} y={deskY - 8} className="px-frame-b" />
        </g>
        <Desk x={x + 18} y={deskY} w={60} on={true} />
        <g className="px-cursor">
          <path d={`M${x + 41} ${deskY - 52}h10l-5 6z`} fill="#ffdf3d" stroke="#2a1e1a" strokeWidth={1} />
        </g>
        <PixelLabel x={x + 46} y={deskY + 34} text="Claude" />
      </g>

      {/* 门：通往市场部大办公室 */}
      <g className="px-person cursor-pointer" onClick={onEnter}>
        <rect x={x + 120} y={y + 36} width={52} height={78} fill="transparent" />
        <rect x={x + 128} y={y + 44} width={36} height={60} fill="#6b4426" stroke="#3e2716" strokeWidth={2} />
        <rect x={x + 132} y={y + 48} width={28} height={24} fill="#8a5a33" />
        <rect x={x + 132} y={y + 76} width={28} height={24} fill="#8a5a33" />
        <circle cx={x + 157} cy={y + 76} r={2} fill="#f2c230" />
        <rect x={x + 122} y={y + 32} width={48} height={12} fill="#2f8f4e" stroke="#1f5e33" strokeWidth={1} />
        <text x={x + 146} y={y + 41} textAnchor="middle" fontSize={8} fill="#fff" className="px-font" fontWeight={700}>
          {BIG_ROOM}
        </text>
        <g className="px-arrow">
          <path d={`M${x + 136} ${y + 112}h12v-5l9 9l-9 9v-5h-12z`} fill="#ffdf3d" stroke="#2a1e1a" strokeWidth={1.5} />
        </g>
        {alert && (
          <g className="px-bang">
            <rect x={x + 168} y={y + 40} width={10} height={13} fill="#fff" stroke="#2a1e1a" strokeWidth={1.5} />
            <rect x={x + 172} y={y + 42} width={2} height={6} fill="#e5383b" />
            <rect x={x + 172} y={y + 50} width={2} height={2} fill="#e5383b" />
          </g>
        )}
        <text x={x + 146} y={y + 140} textAnchor="middle" fontSize={7} fill="#3a2a20" className="px-font">
          {inside.people.length} 位同事在里面
        </text>
      </g>
    </g>
  );
}

/**
 * 进门后的市场部大办公室（2026-11-06 起社媒运营并进市场部）：两间打通——左边拍摄工作室（Mark、Chase、MAC），
 * 右边农场（Leo、Ivy 等），中间墙上开门，顶上一块大招牌。左上角回去。
 */
const STUDIO_KEYS = new Set(["mark", "mac", "macmini"]);  // 左：策划 Mark + 发布 Chase + MAC；右：剪辑 Leo + 检查 Ivy

// ---- 市场部流水线（2026-11-06 Wallace：「做一个流水线的动画吧，每个人的职责都以动画形式呈现」）----
// 一条传送带：Mark 写稿 → IP 拍摄 → Drive → Leo 剪辑 → Chase 发布 → Ivy 检查。一件「货」沿着传送带走，
// 每到一站变个样子（稿纸 → 胶片 → 云文件 → 成片 → 手机 → ✓）。哪一站的人头上冒「!」，货就停在那一站闪红。
type Station = { key: string; label: string; who?: string };
const STATIONS: Station[] = [
  { key: "script", label: "Mark 写稿", who: "mark" },
  { key: "shoot", label: "IP 拍摄" },
  { key: "drive", label: "传 Drive" },
  { key: "edit", label: "Leo 剪辑", who: "leo" },
  { key: "post", label: "Chase 发布", who: "mac" },
  { key: "check", label: "Ivy 检查", who: "inspector" },
];

function Cargo({ stage, x, y }: { stage: number; x: number; y: number }) {
  // 6 个样子，都画在 16×14 的格子里
  switch (stage) {
    case 0: // 稿纸
      return (
        <g>
          <rect x={x} y={y} width={12} height={14} fill="#fffdf4" stroke="#2a1e1a" strokeWidth={1} />
          {[3, 6, 9].map((d) => <rect key={d} x={x + 2} y={y + d} width={8} height={1} fill="#8a8a99" />)}
        </g>
      );
    case 1: // 胶片（原片）
      return (
        <g>
          <rect x={x - 1} y={y + 2} width={16} height={10} fill="#2d2d3a" />
          {[0, 4, 8, 12].map((d) => <rect key={d} x={x + d} y={y + 3} width={2} height={2} fill="#fffdf4" />)}
          {[0, 4, 8, 12].map((d) => <rect key={"b" + d} x={x + d} y={y + 9} width={2} height={2} fill="#fffdf4" />)}
        </g>
      );
    case 2: // 云文件
      return (
        <g fill="#8fd0ff" stroke="#3a6fa8" strokeWidth={1}>
          <rect x={x} y={y + 5} width={16} height={8} rx={4} />
          <rect x={x + 4} y={y + 1} width={8} height={8} rx={4} />
        </g>
      );
    case 3: // 剪好的成片
      return (
        <g>
          <rect x={x} y={y + 1} width={16} height={12} fill="#d4704f" stroke="#2a1e1a" strokeWidth={1} />
          <path d={`M${x + 6} ${y + 4}l5 3l-5 3z`} fill="#fffdf4" />
        </g>
      );
    case 4: // 发出去的手机
      return (
        <g>
          <rect x={x + 3} y={y} width={10} height={14} rx={1} fill="#1f1f28" />
          <rect x={x + 4} y={y + 1} width={8} height={11} fill="#7fc3ff" />
          <rect x={x + 6} y={y + 5} width={4} height={3} fill="#e5383b" />
        </g>
      );
    default: // 检查通过
      return (
        <g>
          <rect x={x} y={y} width={14} height={14} fill="#2f9e57" stroke="#1f5e33" strokeWidth={1} />
          <path d={`M${x + 3} ${y + 7}l3 3l5 -6`} stroke="#fff" strokeWidth={2} fill="none" />
        </g>
      );
  }
}

function Conveyor({ x, y, w, people }: { x: number; y: number; w: number; people: PixelPerson[] }) {
  const n = STATIONS.length;
  const gap = (w - 40) / (n - 1);
  const sx = (i: number) => x + 20 + i * gap;
  const mood = (who?: string) => people.find((p) => p.key === who)?.mood;
  const stuck = STATIONS.findIndex((st) => st.who && mood(st.who) === "alert");
  // 动画：每站停 1.2 秒、走 0.8 秒，一圈 12 秒
  const T = 12;
  const seg = T / n;
  const times: number[] = [];
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    times.push((i * seg) / T, (i * seg + seg * 0.6) / T);
    xs.push(sx(i) - 8, sx(i) - 8);
  }
  times.push(1);
  xs.push(sx(0) - 8);
  return (
    <g>
      {/* 传送带 */}
      <rect x={x} y={y + 22} width={w} height={10} fill="#55555f" />
      <rect x={x} y={y + 22} width={w} height={2} fill="#7a7a86" />
      <g className="px-belt">
        {[...Array(Math.ceil(w / 12))].map((_, i) => <rect key={i} x={x + i * 12} y={y + 26} width={6} height={2} fill="#3d3d4a" />)}
      </g>
      {/* 站点 */}
      {STATIONS.map((st, i) => {
        const bad = st.who && mood(st.who) === "alert";
        return (
          <g key={st.key}>
            <rect x={sx(i) - 26} y={y + 36} width={52} height={13} fill={bad ? "#e5383b" : "#3a2a20"} />
            <rect x={sx(i) - 25} y={y + 37} width={50} height={11} fill={bad ? "#ffe3e3" : "#fff8e7"} />
            <text x={sx(i)} y={y + 45.5} textAnchor="middle" fontSize={7} fill="#2a1e1a" className="px-font" fontWeight={700}>
              {st.label}
            </text>
            {i < n - 1 && <path d={`M${sx(i) + 28} ${y + 42}h${gap - 56}`} stroke="#c9a06a" strokeWidth={1.5} strokeDasharray="2 2" />}
          </g>
        );
      })}
      {/* 货 */}
      {stuck >= 0 ? (
        <g>
          <g className="px-bang">
            <Cargo stage={stuck} x={sx(stuck) - 8} y={y + 10} />
          </g>
          <rect x={sx(stuck) + 8} y={y - 6} width={10} height={13} fill="#fff" stroke="#2a1e1a" strokeWidth={1.5} />
          <rect x={sx(stuck) + 12} y={y - 4} width={2} height={6} fill="#e5383b" />
          <rect x={sx(stuck) + 12} y={y + 4} width={2} height={2} fill="#e5383b" />
        </g>
      ) : (
        <g>
          <animateTransform attributeName="transform" type="translate" dur={`${T}s`} repeatCount="indefinite"
            keyTimes={times.join(";")} values={xs.map((v) => `${v - (sx(0) - 8)} 0`).join(";")} />
          {STATIONS.map((_, i) => (
            <g key={i} opacity={i === 0 ? 1 : 0}>
              <animate attributeName="opacity" dur={`${T}s`} repeatCount="indefinite" calcMode="discrete"
                {...(i === 0
                  ? { keyTimes: `0;${(seg / T).toFixed(4)};1`, values: "1;0;0" }
                  : i === n - 1
                    ? { keyTimes: `0;${((i * seg) / T).toFixed(4)};1`, values: "0;1;1" }
                    : { keyTimes: `0;${((i * seg) / T).toFixed(4)};${(((i + 1) * seg) / T).toFixed(4)};1`, values: "0;1;0;0" })} />
              <Cargo stage={i} x={sx(0) - 8} y={y + 10} />
            </g>
          ))}
        </g>
      )}
    </g>
  );
}

function BigRoom({ room, onHover, onLeave }: { room: PixelRoom; onHover: (p: PixelPerson) => void; onLeave: () => void }) {
  const studio: PixelRoom = { name: "社媒运营区", people: room.people.filter((p) => STUDIO_KEYS.has(p.key)) };
  const farm: PixelRoom = { name: "剪辑 · 检查区", people: room.people.filter((p) => !STUDIO_KEYS.has(p.key)) };
  const W = ROOM_W * 2 + 16;
  return (
    <svg viewBox={`0 0 ${W} ${ROOM_H + 90}`} className="w-full h-auto block" shapeRendering="crispEdges" role="img" aria-label="市场部办公室">
      <rect width={W} height={ROOM_H + 90} fill="#7a5a3f" />
      <rect x={W / 2 - 110} y={3} width={220} height={18} fill="#3a2a20" />
      <rect x={W / 2 - 108} y={5} width={216} height={14} fill="#fff8e7" />
      <text x={W / 2} y={15.5} textAnchor="middle" fontSize={10} fill="#3a2a20" className="px-font" fontWeight={700}>
        市场部 · 策划 → 剪辑 → 发布 → 检查
      </text>
      <Room room={studio} x={8} y={24} onHover={onHover} onLeave={onLeave} />
      <Room room={farm} x={8 + ROOM_W} y={24} onHover={onHover} onLeave={onLeave} />
      {/* 两间打通：中间墙上开一个门洞 */}
      <rect x={8 + ROOM_W - 3} y={24 + 4 * TILE} width={6} height={3 * TILE} fill="#cdb79a" />
      <Conveyor x={8} y={24 + ROOM_H + 6} w={W - 16} people={room.people} />
    </svg>
  );
}

function Map({ rooms: real, cols, onHover, onLeave, onClaude, onEnter }: { rooms: PixelRoom[]; cols: number; onHover: (p: PixelPerson) => void; onLeave: () => void; onClaude: () => void; onEnter: () => void }) {
  // 最后一排没坐满就补一间会议室（agent 请求开会就是约在这里）
  const rooms = [...real];
  for (const filler of ["会议室", "茶水间"]) if (rooms.length % cols) rooms.push({ name: filler, people: [] });
  const rows = Math.ceil(rooms.length / cols);
  const W = cols * ROOM_W + (cols + 1) * 8;
  const H = rows * ROOM_H + (rows - 1) * HALL + 16;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" shapeRendering="crispEdges" role="img" aria-label="WWFS办公室像素地图">
      <rect width={W} height={H} fill="#7a5a3f" />
      {[...Array(rows - 1)].map((_, r) => (
        <Hall key={r} x={8} y={8 + (r + 1) * ROOM_H + r * HALL} w={W - 16} />
      ))}
      {rooms.map((room, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const rx = 8 + c * (ROOM_W + 8), ry = 8 + r * (ROOM_H + HALL);
        if (room.name === BIG_ROOM) return <ClaudeOffice key={room.name} x={rx} y={ry} inside={room} onEnter={onEnter} onClaude={onClaude} />;
        return <Room key={room.name} room={room} x={rx} y={ry} onHover={onHover} onLeave={onLeave} />;
      })}
      {rows > 1 && <ClaudePatrol x={14} y={8 + ROOM_H + 6} w={W - 28} onClick={onClaude} />}
    </svg>
  );
}

const CLAUDE_TEXT = "我是 Claude，正在各部门巡视：谁在岗、谁卡住了，这里都看得到。\n这里只看反馈；要给哪位同事交代事情，到 Claude 里跟我说。";
const WELCOME_BIG = "这里是市场部。鼠标放在同事身上看他的定时任务和在干什么，点左上角「回办公室」出去。";
const WELCOME = "欢迎来到 WWFS办公室！鼠标放在同事身上看他的定时任务和在干什么，头上有「!」就是卡住了。点一下看详细反馈。";

export default function PixelOffice({ rooms }: { rooms: PixelRoom[] }) {
  const [who, setWho] = useState<PixelPerson | null>(null);
  const [claude, setClaude] = useState(false);
  // 进出市场部：先 0.5 秒渐黑，换画面，再 0.5 秒渐显
  const [view, setView] = useState<"map" | "big">("map");
  const [dark, setDark] = useState(false);
  const full = useMemo(() => {
    if (!who && claude) return CLAUDE_TEXT;
    if (!who) return view === "big" ? WELCOME_BIG : WELCOME;
    if (who.seat) return `${who.name}：${who.title}。这个位子还空着，宣发移交的客户先放在看板「移交销售」。`;
    const lines = [`${who.name}（${who.title}${who.tags ? " · " + who.tags.replace(/,/g, "/") : ""}）· ${who.statusLabel}`];
    // 2026-11-03 Wallace：「感叹号证明卡住了，鼠标滑到这个人身上的时候，显示这个人的定时任务和周期」
    if (who.mood === "alert" && who.stuck) lines.push(`❗ ${who.stuck}`);
    if (who.schedule || who.every) lines.push(`⏰ 定时任务：${who.schedule || "未填"}${who.every ? " · " + who.every : ""}${who.host ? " · " + who.host : ""}`);
    if (who.lastRun !== undefined) lines.push(`🕘 上次运行：${who.lastRun || "还没打过卡"}`);
    lines.push(who.task ? `正在：${who.task}` : "手上没事。");
    if (who.unread) lines.push(`你有 ${who.unread} 条留言他还没看。`);
    return lines.join("\n");
  }, [who, claude, view]);
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setShown(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [full]);

  const leave = () => setWho(null);
  const go = (to: "map" | "big") => {
    if (dark) return;
    setDark(true);
    setWho(null);
    setTimeout(() => {
      setView(to);
      requestAnimationFrame(() => setDark(false));
    }, 550);
  };
  const big = rooms.find((r) => r.name === BIG_ROOM);
  return (
    <div className="px-office relative rounded-2xl overflow-hidden border-4 border-[#3a2a20] shadow-xl bg-[#7a5a3f]">
      <div className="relative">
        {view === "big" && big ? (
          <>
            <BigRoom room={big} onHover={setWho} onLeave={leave} />
            <button
              type="button"
              onClick={() => go("map")}
              className="px-font absolute left-3 top-3 rounded border-2 border-[#2a1e1a] bg-[#ffdf3d] px-3 py-1 text-sm text-[#2a1e1a] shadow hover:brightness-105"
            >
              ◀ 回办公室
            </button>
          </>
        ) : (
          <>
            <div className="hidden md:block">
              <Map rooms={rooms} cols={3} onHover={setWho} onLeave={leave} onClaude={() => setClaude(true)} onEnter={() => go("big")} />
            </div>
            <div className="md:hidden">
              <Map rooms={rooms} cols={2} onHover={setWho} onLeave={leave} onClaude={() => setClaude(true)} onEnter={() => go("big")} />
            </div>
          </>
        )}
        <div className={"pointer-events-none absolute inset-0 bg-black transition-opacity duration-500 " + (dark ? "opacity-100" : "opacity-0")} />
      </div>
      {/* GBA 式对话框 */}
      <div className="bg-[#3a2a20] p-2">
        <div className="px-dialog relative rounded-md bg-[#fffdf4] border-4 border-double border-[#4a6fd8] px-4 py-3 min-h-[7.5rem] text-[15px] leading-relaxed text-[#2a1e1a] whitespace-pre-wrap">
          {shown}
          {claude && !who && (
            <div className="mt-2 flex items-center gap-3">
              <a href="https://claude.ai" target="_blank" rel="noreferrer" className="inline-block rounded border-2 border-[#2a1e1a] bg-[#d4704f] text-white px-3 py-1 text-sm hover:brightness-110">
                ▶ 去 Claude 发布指令
              </a>
              <button type="button" className="text-sm text-stone-500 underline" onClick={() => setClaude(false)}>
                关闭
              </button>
            </div>
          )}
          <span className="px-caret absolute right-3 bottom-2 text-[#4a6fd8]">▼</span>
        </div>
      </div>
    </div>
  );
}

/** 工位页头像：跟办公室里同一个像素小人，放大显示。 */
export function PixelPortrait({ who, name, mood, size = 96 }: { who: string; name: string; mood: PixelPerson["mood"]; size?: number }) {
  const p: PixelPerson = { key: who, name, title: "", tags: null, href: "", mood, statusLabel: "", task: null, unread: 0 };
  return (
    <svg viewBox="-4 -22 36 52" width={size} height={(size * 52) / 36} shapeRendering="crispEdges" className="px-office shrink-0" aria-hidden>
      <Person p={p} x={0} y={0} />
      <Bubble p={p} x={12} y={-6} />
    </svg>
  );
}
