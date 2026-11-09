"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 像素办公室（2026-11-03 Wallace：「我要在首页看到所有员工的脸，可以做成像素风格的，真的画一个办公室出来，
 * 然后这些员工坐在里面办公」——参考 GBA 时代的俯视角像素游戏风格，人物和场景都是自己画的）。
 *
 * 一张 SVG：每个部门一间房，墙、窗、地板、桌子、电脑、绿植；每个人一个 20×26 的像素小人。
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
  schedule?: string | null; // 定时任务：每天 07:35 / 12:35 / 17:35
  every?: string | null; // 周期：每 8 小时一次
  lastRun?: string | null; // 上次跑：3 小时前（打卡内容）
  host?: string | null;
  stuck?: string | null; // 头上「!」的原因
  seat?: boolean; // 空位（招聘中）
  device?: boolean; // 设备本身是一个角色（MAC：市场部四个人的电脑都连着它）
};
export type PixelRoom = { name: string; people: PixelPerson[]; shootStuck?: string | null; driveStuck?: string | null };

// ---- 像素小人（2026-11-09 Wallace：「像素点最好多一点」「现在太抽象了」）----
// 一个人 20×26 像素，一层层叠：头 → 身子 → 衣服 → 发型。五官、领口、领带、耳机都画得出来，全是自己画的。
type Look = { hair: string; skin: string; shirt: string; dark: string; style: string[]; outfit?: string[]; glasses?: boolean; extra?: Record<string, string> };

const HEAD = [
  "....................",
  "....................",
  "....OOOOOOOOOOOO....",
  "...OSSSSSSSSSSSSO...",
  "...OSSSSSSSSSSSSO...",
  "...OSSSSSSSSSSSSO...",
  "...OSSSSSSSSSSSSO...",
  "...OSSKKKSSKKKSSO...",
  "..OsSSWESSSSWESSsO..",
  "..OsSSEESSSSEESSsO..",
  "...OBSSSSssSSSSBO...",
  "...OSSSSSSSSSSSSO...",
  "...OSSSSMMMMSSSSO...",
  "....OSSSSSSSSSSO....",
  ".....OOOSSSSOOO.....",
  ".......OssssO.......",
  "....OOCCCssCCCOO....",
  "..OOCCCCCssCCCCCOO..",
  ".OCCCCCCCCCCCCCCCCO.",
  ".OCcCCCCCCCCCCCCcCO.",
  ".OCcCCCCCCCCCCCCcCO.",
  ".OCcCCCCCCCCCCCCcCO.",
  ".OCcCCCCCCCCCCCCcCO.",
  ".OCcCCCCCCCCCCCCcCO.",
  ".OCcCCCCCCCCCCCCcCO.",
  ".OCcCCCCCCCCCCCCcCO.",
];
const HAIR_CROP = [
  "....................",
  ".....OOOOOOOOOO.....",
  "...OOHHHHHHHHHHOO...",
  "..OHHHhhhHHHHHHHHO..",
  "..OHHhhHHHHHHHHHHO..",
  "..OHHHHHHHHHHHHHHO..",
  "..OHH.HHHH.HHH.HHO..",
  "..OH............HO..",
];
const HAIR_WAVY_PHONES = [
  ".....GGGGGGGGGG.....",
  "...GGOOOOOOOOOOGG...",
  "..GOOHHHHHHHHHHOOG..",
  ".G.OHhHHHhHHHhHHO.G.",
  ".G.OhHHHhHHHhHHHO.G.",
  ".G.OHHHHHHHHHHHHO.G.",
  ".G.OHH.HHHHH.HHHO.G.",
  "GgGOH..........HOGgG",
  "GgG..............GgG",
  "GgG..............GgG",
  "GgG..............GgG",
  ".G................G.",
];
const HAIR_BOB_BERET = [
  "......KKKKKKKK......",
  "....KKkKKKKKKKKK....",
  "..KKKKKKKKKKKKKKKK..",
  "..OOOOOOOOOOOOOOOO..",
  "..OHHHHHHHHHHHHHHO..",
  "..OHHhHH.HHHHHHHHO..",
  "..OHHH.......HHHHO..",
  ".OHHH..........HHHO.",
  ".OHHH..........HHHO.",
  ".OHHH..........HHHO.",
  ".OHhH..........HhHO.",
  ".OHHH..........HHHO.",
  ".OHHH..........HHHO.",
  ".OHHH..........HHHO.",
  ".OHHHO........OHHHO.",
  "..OOO..........OOO..",
];
const HAIR_LONG = [
  "....................",
  ".....OOOOOOOOOO.....",
  "...OOHHHHHHHHHHOO...",
  "..OHHHhhHHHhhHHHHO..",
  "..OHHhhHHHHHhhHHHO..",
  "..OHHHHHH..HHHHHHO..",
  ".OHHHHH......HHHHHO.",
  ".OHHH..........HHHO.",
  ".OHHH..........HHHO.",
  ".OHhH..........HhHO.",
  ".OHhH..........HhHO.",
  ".OHHH..........HHHO.",
  ".OHHH..........HHHO.",
  ".OHHH..........HHHO.",
  ".OHHHH........HHHHO.",
  ".OHHHH........HHHHO.",
  ".OHhHH........HHhHO.",
  ".OHHHH........HHHHO.",
  ".OHHHH........HHHHO.",
  "..OOOO........OOOO..",
];
const HAIR_SIDE = [
  "....................",
  ".....OOOOOOOOOO.....",
  "...OOHHHHHHHHHHOO...",
  "..OHHHHHHHHhhhHHHO..",
  "..OHHHHHHHhhHHHHHO..",
  "..OHHHHHHHHHHHHHHO..",
  "..OHHH..........HO..",
  "..OH............HO..",
];
const HAIR_BUN = [
  ".......OHHHHO.......",
  ".......OHhHHO.......",
  "....OOOOHHHHOOOO....",
  "...OHHHHHHHHHHHHO...",
  "..OHHHhhHHHHHHHHHO..",
  "..OHHHHHHHHHHHHHHO..",
  "..OHHHH......HHHHO..",
  "..OH............HO..",
];
const HAT_DETECTIVE = [
  ".....KKYKKYKKYK.....",
  "....KYKKYKKYKKYK....",
  "...KKYKKYKKYKKYKK...",
  "...YKKYKKYKKYKKYK...",
  "...KKYKKYKKYKKYKK...",
  "..OOOOOOOOOOOOOOOO..",
  "..XXXXXXXXXXXXXXXX..",
  "..OH............HO..",
];
const HOOD = [
  "....................",
  ".....OOOOOOOOOO.....",
  "...OOHHHHHHHHHHOO...",
  "..OHHHhhHHHHHHHHHO..",
  "..OHhhHHHHHHHHHHHO..",
  "..OHHHHHHHHHHHHHHO..",
  "..OHHHH......HHHHO..",
  "..OHH..........HHO..",
  "..OHH..........HHO..",
  "..OHH..........HHO..",
  "..OHH..........HHO..",
  "..OHHH........HHHO..",
  "..OHHHH......HHHHO..",
  "...OHHHH....HHHHO...",
  "....OOHHHHHHHHOO....",
];
// 衣服从第 16 行开始叠
const SHIRT = [
  ".......WWssWW.......",
  "........WssW........",
  ".........cc.........",
  ".........Wc..cccc...",
  ".........cc..c..c...",
  ".........Wc..cccc...",
  ".........cc.........",
  ".........Wc.........",
];
const HOODIE = [
  "......ccCssCcc......",
  ".....cccCssCccc.....",
  "........W..W........",
  "........W..W........",
  "........W..W........",
  "....................",
  ".....cccccccccc.....",
  ".....c........c.....",
];
const JACKET = [
  ".......WWssWW.......",
  "......DWWWWWWD......",
  "......DWWWWWWD......",
  "......DWWKKWWD......",
  "......DWWKKWWD......",
  "......DWWWWWWD......",
  "......DWWWWWWD......",
  "......DWWWWWWD......",
];
const SUIT = [
  ".......WWssWW.......",
  "......LWWWWWWL......",
  ".....LLWWDDWWLL.....",
  "......LLWDDWLL......",
  ".......LLDDLL.......",
  "........LDDL........",
  ".........LL.........",
  ".........oo.........",
];
const TRENCH = [
  "......LLLssLLL......",
  ".....LLLLssLLLL.....",
  "......LLLccLLL......",
  ".......LLccLL.......",
  "......o..cc..o......",
  ".........cc.........",
  "...DDDDDDooDDDDDD...",
  "......o..cc..o......",
];
const BLAZER = [
  ".......WWssWW.......",
  "......LWWssWWL......",
  "......LLWWWWLL......",
  ".......LLWWLL.......",
  "........LWWL........",
  ".........LL.........",
  ".........oo.........",
  "....................",
];
const CARDIGAN = [
  ".......WWssWW.......",
  ".......cWWWWc.......",
  ".......cWWWWc.......",
  ".......cWWWWc.o.....",
  ".......cWWWWc.......",
  ".......cWWWWc.o.....",
  ".......cWWWWc.......",
  ".......cWWWWc.o.....",
];

const LOOKS: Record<string, Look> = {
  // Mark 策划文案：短发、蓝衬衫
  mark: { hair: "#2b2b3a", skin: "#f6c9a4", shirt: "#2f7fd0", dark: "#235e9c", style: HAIR_CROP, outfit: SHIRT },
  // Leo 剪辑：卷发、头戴耳机、红卫衣
  leo: { hair: "#7a4f27", skin: "#f6cfa8", shirt: "#d9503f", dark: "#a93a2c", style: HAIR_WAVY_PHONES, outfit: HOODIE, extra: { G: "#2d2d3a", g: "#55c1ff" } },
  // Chase 发布：贝雷帽、紫外套、白 T
  mac: { hair: "#c2542f", skin: "#f8d2b4", shirt: "#7a6bd6", dark: "#5a4cb0", style: HAIR_BOB_BERET, outfit: JACKET, extra: { K: "#e0457b", k: "#f28bb0" } },
  // Ivy 检查：格子侦探帽、驼色风衣
  inspector: { hair: "#5a3a22", skin: "#f8d5b8", shirt: "#c69a5b", dark: "#6e4f28", style: HAT_DETECTIVE, outfit: TRENCH, extra: { K: "#8a6a44", Y: "#5c4329", X: "#6e5233", L: "#ddb981", o: "#3a2a20" } },
  // Bob 销售：西装领带；Tina 会计：发髻 + 眼镜 + 开衫
  bob: { hair: "#4a3424", skin: "#f1c29c", shirt: "#2f3a5c", dark: "#d9452f", style: HAIR_SIDE, outfit: SUIT, extra: { L: "#46547f", o: "#c9ccd8" } },
  tina: { hair: "#2a1a14", skin: "#f8d5b8", shirt: "#4c9a6a", dark: "#357350", style: HAIR_BUN, outfit: CARDIGAN, glasses: true, extra: { o: "#f2e4b8" } },
  amelia: { hair: "#3a2418", skin: "#f8d2b4", shirt: "#ec5f9e", dark: "#be3d77", style: HAIR_LONG, outfit: BLAZER, extra: { L: "#f58cbb", o: "#fff1c9" } },
  recruit: { hair: "#1f1f2a", skin: "#f4c7a2", shirt: "#16a394", dark: "#0f766e", style: HAIR_BUN, outfit: CARDIGAN, extra: { o: "#f2e4b8" } },
  ryzen: { hair: "#555a66", skin: "#eebf98", shirt: "#64748b", dark: "#46505f", style: HAIR_SIDE, outfit: SHIRT },
  ishan: { hair: "#15151c", skin: "#b9805a", shirt: "#2f9e57", dark: "#21763f", style: HAIR_CROP, outfit: SHIRT },
};
const FALLBACK = ["#e05d5d", "#4fa3e0", "#9fc94f", "#e0a84f", "#7a6fe0"];
function lookFor(key: string): Look {
  const k = key.toLowerCase();
  if (LOOKS[k]) return LOOKS[k];
  const h = [...k].reduce((n, c) => n + c.charCodeAt(0), 0);
  const c = FALLBACK[h % FALLBACK.length];
  return { hair: "#3a2a20", skin: "#f3c6a0", shirt: c, dark: c, style: h % 2 ? HAIR_LONG : HAIR_CROP, outfit: h % 2 ? BLAZER : SHIRT, extra: { L: c, o: "#fff1c9" } };
}

/** 颜色调亮（amt > 0）或调暗（amt < 0）。 */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt).toString(16).padStart(2, "0");
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

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
      rects.push(<rect key={`${r}-${c}`} x={x + c} y={y + r} width={run} height={1} fill={pal[ch]} />);
      c += run;
    }
  });
  return <g className={className}>{rects}</g>;
}

const R = (x: number, y: number, w: number, h: number, fill: string, className?: string, opacity?: number) => <rect x={x} y={y} width={w} height={h} fill={fill} className={className} opacity={opacity} />;

function lookPal(L: Look): Record<string, string> {
  return {
    O: "#2a1e1a", H: L.hair, h: shade(L.hair, 0.28), K: shade(L.hair, -0.25), S: L.skin, s: shade(L.skin, -0.14), B: "#f5b0a6", E: "#1a1420", W: "#ffffff",
    M: "#b5525a", C: L.shirt, c: shade(L.shirt, -0.2), D: L.dark,
    ...(L.extra || {}),
  };
}

function Person({ p, x, y }: { p: PixelPerson; x: number; y: number }) {
  const L = lookFor(p.key);
  const pal = lookPal(L);
  const asleep = p.mood === "sleep";
  return (
    <g className={"px-bob " + (asleep ? "px-slow" : "")}>
      <Pixels rows={HEAD} pal={pal} x={x} y={y} />
      {L.outfit && <Pixels rows={L.outfit} pal={pal} x={x} y={y + 16} />}
      <Pixels rows={L.style} pal={pal} x={x} y={y} />
      {L.glasses && (
        <g fill="#2a1e1a">
          {[5, 11].map((d) => (
            <g key={d}>
              {R(x + d, y + 7, 5, 1, "#2a1e1a")}
              {R(x + d, y + 10, 5, 1, "#2a1e1a")}
              {R(x + d, y + 7, 1, 4, "#2a1e1a")}
              {R(x + d + 4, y + 7, 1, 4, "#2a1e1a")}
            </g>
          ))}
          {R(x + 10, y + 8, 1, 1, "#2a1e1a")}
        </g>
      )}
      {p.mood === "happy" && <>{R(x + 8, y + 12, 4, 2, "#b5525a")}{R(x + 9, y + 12, 2, 1, "#ffffff")}</>}
      {p.mood === "alert" && <>{R(x + 8, y + 12, 4, 1, L.skin)}{R(x + 9, y + 12, 2, 2, "#7a2f35")}</>}
      {asleep ? (
        <g>
          {R(x + 6, y + 8, 2, 2, L.skin)}
          {R(x + 12, y + 8, 2, 2, L.skin)}
          {R(x + 6, y + 9, 2, 1, "#1a1420")}
          {R(x + 12, y + 9, 2, 1, "#1a1420")}
        </g>
      ) : (
        <g className="px-blink">
          {R(x + 6, y + 8, 2, 2, L.skin)}
          {R(x + 12, y + 8, 2, 2, L.skin)}
          {R(x + 6, y + 9, 2, 1, "#1a1420")}
          {R(x + 12, y + 9, 2, 1, "#1a1420")}
        </g>
      )}
      {/* 手搭在键盘上，干活时左右轮流敲 */}
      {p.mood === "work" || p.mood === "happy" ? (
        <>
          <g className="px-frame-a">{R(x + 4, y + 22, 4, 3, L.skin)}{R(x + 12, y + 23, 4, 2, L.skin)}</g>
          <g className="px-frame-b">{R(x + 4, y + 23, 4, 2, L.skin)}{R(x + 12, y + 22, 4, 3, L.skin)}</g>
        </>
      ) : (
        <>{R(x + 4, y + 23, 4, 2, L.skin)}{R(x + 12, y + 23, 4, 2, L.skin)}</>
      )}
    </g>
  );
}

// ---- 家具 ----------------------------------------------------------------
/** 办公桌：木桌面、抽屉、显示器（屏幕里有在写的内容）、键盘、鼠标、杯子。显示器在左边，不挡人。 */
function Desk({ x, y, w, on, screen }: { x: number; y: number; w: number; on: boolean; screen?: string }) {
  const lit = on ? screen || "#a7e3ff" : "#30303c";
  const kx = x + w - 24;
  return (
    <g>
      {R(x, y, w, 5, "#c8935a")}
      {R(x, y, w, 1, "#dfb07a")}
      {R(x + 6, y + 2, 7, 1, "#b98248")}
      {R(x + w - 12, y + 3, 8, 1, "#b98248")}
      {R(x, y + 5, w, 11, "#9c6a3c")}
      {R(x, y + 5, w, 1, "#7a4f2a")}
      {R(x + 3, y + 8, w - 6, 1, "#8a5c33")}
      {R(x + 3, y + 13, w - 6, 1, "#8a5c33")}
      {R(x, y + 16, w, 1, "#5e3b20")}
      {R(x + 2, y + 17, 3, 6, "#6b4426")}
      {R(x + w - 5, y + 17, 3, 6, "#6b4426")}
      {/* 显示器 */}
      {R(x + 2, y - 15, 19, 13, "#23232d")}
      {R(x + 3, y - 14, 17, 10, lit, on ? "px-screen" : undefined)}
      {on && (
        <g>
          {R(x + 4, y - 13, 9, 1, "#2f5f8f")}
          {R(x + 4, y - 11, 13, 1, "#2f5f8f")}
          {R(x + 4, y - 9, 6, 1, "#e0704f")}
          {R(x + 4, y - 7, 11, 1, "#2f5f8f")}
        </g>
      )}
      {R(x + 3, y - 3, 17, 1, "#3a3a46")}
      {R(x + 10, y - 2, 3, 2, "#55555f")}
      {R(x + 7, y, 9, 1, "#3a3a46")}
      {/* 键盘 + 鼠标 */}
      {R(kx, y + 1, 16, 3, "#e6e6ec")}
      {[0, 2, 4, 6, 8, 10, 12, 14].map((d) => <g key={d}>{R(kx + d, y + 2, 1, 1, "#9a9aa8")}</g>)}
      {R(kx + 18, y + 2, 3, 2, "#e6e6ec")}
    </g>
  );
}
/** 办公椅：靠背露在人的两侧和头后面。 */
function Chair({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {R(x + 3, y, 18, 8, "#3b3f4c")}
      {R(x + 4, y + 1, 16, 2, "#565b6b")}
      {R(x, y + 8, 24, 16, "#3b3f4c")}
      {R(x + 1, y + 9, 22, 2, "#565b6b")}
    </g>
  );
}
function Plant({ x, y }: { x: number; y: number }) {
  return (
    <Pixels
      x={x}
      y={y}
      pal={{ G: "#3f9d55", g: "#67c174", D: "#2b7440", T: "#c56f43", t: "#e08c5c", d: "#8a4a2c" }}
      rows={[
        "......Gg........",
        "....gGGG..G.....",
        "...GGgGD.GgG....",
        ".G..GGGDGGGD..g.",
        "GgG..DGDGgD..GG.",
        "GGGD..GDGD..GgGD",
        ".DGGG.GDD.GGGD..",
        "...DGGGDGGGD....",
        "..g..DGDGD..G...",
        "..GGD.GDD.GGD...",
        "...DGGGDGGD.....",
        ".....DGDD.......",
        "...tttttttttt...",
        "...TTTTTTTTTd...",
        "....TTTTTTTd....",
        "....TTTTTTTd....",
        ".....TTTTTd.....",
        ".....dddddd.....",
      ]}
    />
  );
}
/** 书架：一排排有颜色的书。 */
function Shelf({ x, y }: { x: number; y: number }) {
  const books = ["#d9503f", "#2f7fd0", "#f2c230", "#4c9a6a", "#7a6bd6", "#e0845c", "#3a3a46", "#ec5f9e"];
  return (
    <g>
      {R(x, y, 28, 30, "#7a4f2a")}
      {R(x + 2, y + 2, 24, 26, "#4a2f1a")}
      {R(x + 2, y + 14, 24, 2, "#7a4f2a")}
      {[...Array(8)].map((_, i) => <g key={i}>{R(x + 3 + i * 3, y + 5 + (i % 3), 2, 9 - (i % 3), books[i])}</g>)}
      {[...Array(8)].map((_, i) => <g key={"b" + i}>{R(x + 3 + i * 3, y + 19 + ((i * 2) % 3), 2, 9 - ((i * 2) % 3), books[(i + 3) % 8])}</g>)}
    </g>
  );
}
/** 摄像机上三脚架：机身、镜头玻璃、录制灯。 */
function Camera({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {R(x + 7, y - 3, 8, 3, "#23232d")}
      {R(x + 2, y, 20, 13, "#23232d")}
      {R(x + 3, y + 1, 18, 2, "#42424f")}
      {R(x + 3, y + 3, 3, 6, "#3a3a46")}
      {R(x + 22, y + 2, 3, 9, "#3a3a46")}
      {R(x + 25, y + 1, 4, 11, "#55555f")}
      {R(x + 29, y + 2, 2, 9, "#1a1a22")}
      {R(x + 30, y + 4, 1, 5, "#6fb6ff")}
      {R(x + 30, y + 4, 1, 2, "#ffffff")}
      {R(x + 18, y + 1, 2, 1, "#ff4d4d", "px-rec")}
      {R(x + 10, y + 13, 4, 3, "#55555f")}
      <path d={`M${x + 12} ${y + 16}l-9 20M${x + 12} ${y + 16}v20M${x + 12} ${y + 16}l9 20`} stroke="#55555f" strokeWidth={1.5} fill="none" />
    </g>
  );
}
function Board({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      {R(x, y, 34, 18, "#7a4f2a")}
      {R(x + 1, y + 1, 32, 16, "#fff8e7")}
      <text x={x + 17} y={y + 12} textAnchor="middle" fontSize={7} fill="#c0392b" className="px-font" fontWeight={700}>
        {label}
      </text>
    </g>
  );
}
/** 白板：业绩柱子往上走。 */
function ChartBoard({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {R(x, y, 40, 28, "#9a9aa8")}
      {R(x + 1, y + 1, 38, 26, "#ffffff")}
      {[[5, 8], [12, 12], [19, 10], [26, 17], [33, 21]].map(([d, h]) => <g key={d}>{R(x + d, y + 24 - h, 4, h, d === 33 ? "#2f9e57" : "#7aa8e0")}</g>)}
      {R(x + 3, y + 24, 34, 1, "#3a3a46")}
      {R(x + 6, y + 28, 2, 10, "#7a7a86")}
      {R(x + 32, y + 28, 2, 10, "#7a7a86")}
    </g>
  );
}
/** 文件柜：三层抽屉，有标签有把手。 */
function Cabinet({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {R(x, y, 30, 34, "#8d97a5")}
      {R(x, y, 30, 2, "#b3bcc8")}
      {[3, 13, 23].map((d) => (
        <g key={d}>
          {R(x + 2, y + d, 26, 9, "#a5afbc")}
          {R(x + 2, y + d + 8, 26, 1, "#6f7986")}
          {R(x + 10, y + d + 2, 10, 3, "#fffdf4")}
          {R(x + 12, y + d + 6, 6, 1, "#3a3a46")}
        </g>
      ))}
    </g>
  );
}
/** 会议室：长桌、椅子、笔电、水杯。 */
function MeetingTable({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {[8, 34, 60, 86].map((d) => <g key={d}>{R(x + d, y - 12, 16, 10, "#3b3f4c")}{R(x + d + 1, y - 11, 14, 2, "#565b6b")}{R(x + d, y + 28, 16, 8, "#3b3f4c")}</g>)}
      {R(x, y, 112, 24, "#a87447")}
      {R(x, y, 112, 2, "#c8935a")}
      {R(x, y + 24, 112, 3, "#6b4426")}
      {R(x + 12, y + 8, 18, 10, "#d8d8de")}
      {R(x + 13, y + 9, 16, 7, "#7fc3ff", "px-screen")}
      {R(x + 70, y + 8, 18, 10, "#d8d8de")}
      {R(x + 71, y + 9, 16, 7, "#8fe08a", "px-screen")}
      {R(x + 48, y + 9, 5, 6, "#fffdf4")}
      {R(x + 53, y + 10, 2, 3, "#fffdf4")}
    </g>
  );
}
/** 柔光灯：黑罩、发光的柔光布、灯架三只脚。 */
function Softbox({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x - 4} ${y - 2}h30v22h-30z`} fill="#fff6c8" opacity={0.25} />
      <path d={`M${x} ${y}h22v18h-22z`} fill="#23232d" />
      {R(x + 2, y + 2, 18, 14, "#fffbe4", "px-screen")}
      {R(x + 10, y + 2, 1, 14, "#efe2b4")}
      {R(x + 2, y + 8, 18, 1, "#efe2b4")}
      {R(x + 10, y + 18, 2, 18, "#55555f")}
      <path d={`M${x + 11} ${y + 30}l-8 8M${x + 11} ${y + 30}l8 8`} stroke="#55555f" strokeWidth={1.5} fill="none" />
    </g>
  );
}
/** 环形补光灯夹手机。 */
function RingLight({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x + 8} cy={y + 9} r={8} fill="none" stroke="#fff6c8" strokeWidth={3} className="px-screen" />
      {R(x + 5, y + 3, 7, 12, "#1f1f28")}
      {R(x + 6, y + 4, 5, 9, "#7fc3ff")}
      {R(x + 9, y + 5, 1, 1, "#ff4d4d", "px-rec")}
      {R(x + 7, y + 18, 2, 14, "#55555f")}
      <path d={`M${x + 8} ${y + 28}l-6 6M${x + 8} ${y + 28}l6 6`} stroke="#55555f" strokeWidth={1.5} fill="none" />
    </g>
  );
}
function OnAir({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {R(x, y, 24, 11, "#3a1a1a")}
      {R(x + 1, y + 1, 22, 9, "#561f1f")}
      <text x={x + 12} y={y + 8} textAnchor="middle" fontSize={6} fill="#ff6a6a" className="px-font px-rec" fontWeight={700}>
        ● REC
      </text>
    </g>
  );
}
/** MAC：四个人的电脑都连到它。显示器就是它的脸，下面压着主机盒，亮灯。 */
function MacFace({ x, y, mood }: { x: number; y: number; mood: PixelPerson["mood"] }) {
  const screen = mood === "alert" ? "#ff9a9a" : mood === "sleep" ? "#3d3d4a" : "#9ad6ff";
  return (
    <g className="px-bob">
      {R(x, y, 34, 22, "#c9c9d2")}
      {R(x, y, 34, 1, "#ececf2")}
      {R(x + 2, y + 2, 30, 17, screen, mood === "sleep" ? undefined : "px-screen")}
      {R(x + 2, y + 2, 30, 2, "#ffffff", undefined, 0.35)}
      {mood === "sleep" ? (
        <g>{R(x + 9, y + 10, 4, 1, "#9a9aa8")}{R(x + 21, y + 10, 4, 1, "#9a9aa8")}</g>
      ) : (
        <g>
          {R(x + 10, y + 7, 3, 5, "#1a1420")}
          {R(x + 21, y + 7, 3, 5, "#1a1420")}
          {R(x + 10, y + 7, 1, 1, "#ffffff")}
          {R(x + 21, y + 7, 1, 1, "#ffffff")}
          <g className="px-blink">{R(x + 10, y + 7, 3, 5, screen)}{R(x + 21, y + 7, 3, 5, screen)}</g>
          {R(x + 7, y + 12, 2, 1, "#f5b0a6")}
          {R(x + 25, y + 12, 2, 1, "#f5b0a6")}
        </g>
      )}
      {mood === "alert" ? R(x + 15, y + 13, 4, 3, "#1a1420") : <>{R(x + 14, y + 15, 6, 1, "#1a1420")}{R(x + 13, y + 14, 1, 1, "#1a1420")}{R(x + 20, y + 14, 1, 1, "#1a1420")}</>}
      {R(x + 13, y + 22, 8, 3, "#a9a9b4")}
      {R(x + 4, y + 25, 26, 6, "#d8d8de")}
      {R(x + 4, y + 25, 26, 1, "#f2f2f7")}
      {R(x + 26, y + 28, 2, 1, mood === "alert" ? "#ff4d4d" : "#4dff8a", "px-rec")}
      {[8, 11, 14, 17].map((d) => <g key={d}>{R(x + d, y + 28, 2, 1, "#8a8a96")}</g>)}
    </g>
  );
}
/** 茶水间：咖啡机、沙发、茶几。 */
function Pantry({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {R(x - 6, y + 6, 40, 12, "#9c6a3c")}
      {R(x - 6, y + 6, 40, 2, "#c8935a")}
      {R(x + 4, y - 14, 18, 20, "#3a3a46")}
      {R(x + 5, y - 13, 16, 3, "#55555f")}
      {R(x + 7, y - 9, 12, 4, "#9fe08a", "px-screen")}
      {R(x + 10, y - 3, 6, 2, "#23232d")}
      {R(x + 10, y + 1, 6, 5, "#fffdf4")}
      {R(x + 11, y - 2, 1, 3, "#e8e8e8", "px-zzz")}
      {R(x + 60, y - 8, 58, 14, "#c9603f")}
      {R(x + 62, y - 6, 26, 10, "#df7d5c")}
      {R(x + 90, y - 6, 26, 10, "#df7d5c")}
      {R(x + 58, y + 4, 62, 12, "#b5502f")}
      {R(x + 62, y + 5, 26, 6, "#d4704f")}
      {R(x + 90, y + 5, 26, 6, "#d4704f")}
      {R(x + 54, y, 7, 18, "#a24527")}
      {R(x + 117, y, 7, 18, "#a24527")}
      {R(x + 72, y + 30, 34, 3, "#c8935a")}
      {R(x + 72, y + 33, 34, 5, "#8a5c33")}
      {R(x + 84, y + 25, 6, 6, "#fffdf4")}
      {R(x + 90, y + 26, 2, 3, "#fffdf4")}
    </g>
  );
}

const ROOM_FLOOR: Record<string, [string, string]> = {
  市场部: ["#d7e8f7", "#c9def2"],
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
const BIG_ROOM = "市场部";
// 2026-11-09 Wallace：「排序是 Mark-Leo-Chase-Ivy，四个人的电脑都连接到 MAC」
const SEAT_ORDER = ["mark", "leo", "mac", "inspector"];

function Worker({ p, x, deskY, w, on, screen, onHover, onLeave }: { p: PixelPerson; x: number; deskY: number; w: number; on: boolean; screen?: string; onHover: (p: PixelPerson) => void; onLeave: () => void }) {
  const router = useRouter();
  const px = x + w - 21;
  const py = deskY - 24;
  return (
    <g className="px-person cursor-pointer" onClick={() => (p.external ? window.open(p.href, "_blank") : router.push(p.href))} onMouseEnter={() => onHover(p)} onMouseLeave={onLeave}>
      <rect x={x} y={py - 14} width={w} height={62} fill="transparent" />
      <Chair x={px - 2} y={py - 2} />
      <Person p={p} x={px} y={py} />
      <Desk x={x} y={deskY} w={w} on={on} screen={screen} />
      <Bubble p={p} x={px + 3} y={py + 2} />
      <g className="px-cursor">
        <path d={`M${px + 5} ${py - 8}h10l-5 6z`} fill="#ffdf3d" stroke="#2a1e1a" strokeWidth={1} />
      </g>
      <PixelLabel x={x + w / 2} y={deskY + 14} text={p.name} />
    </g>
  );
}

/** 市场部（摄影棚）：四张桌一排，每台电脑拉一根线到中间的 MAC，线上有数据在跑。 */
function StudioSeats({ room, x, y, onHover, onLeave }: { room: PixelRoom; x: number; y: number; onHover: (p: PixelPerson) => void; onLeave: () => void }) {
  const router = useRouter();
  const mac = room.people.find((p) => p.device);
  const staff = room.people.filter((p) => !p.device);
  const rank = (p: PixelPerson) => (SEAT_ORDER.indexOf(p.key) + 1 || 99);
  const people = [...staff].sort((a, b) => rank(a) - rank(b));
  const w = Math.min(44, 176 / Math.max(1, people.length));
  const left = x + (ROOM_W - w * people.length) / 2;
  const deskY = y + 66;
  const busY = y + 100;
  const macX = x + ROOM_W / 2 - 17;
  const macY = y + 108;
  const cableX = (i: number) => left + i * w + 12;
  const paths = people.map((_, i) => `M${cableX(i)} ${deskY + 1}V${busY}H${x + ROOM_W / 2}V${macY + 1}`);
  return (
    <g>
      {paths.map((d) => <path key={"o" + d} d={d} stroke="#1e3a5f" strokeWidth={3} fill="none" />)}
      {paths.map((d) => <path key={d} d={d} stroke="#4fc3f7" strokeWidth={1} fill="none" />)}
      {people.map((p, i) => (
        <Worker key={p.key} p={p} x={left + i * w + 1} deskY={deskY} w={w - 2} on={p.mood === "work" || p.mood === "happy"} onHover={onHover} onLeave={onLeave} />
      ))}
      {/* 线画在桌前：从显示器底座下来，数据往 MAC 跑 */}
      {paths.map((d, i) => (
        <path key={"f" + d} d={d} stroke="#ffffff" strokeWidth={1} strokeDasharray="2 10" fill="none">
          <animate attributeName="stroke-dashoffset" from="12" to="0" dur="0.9s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
        </path>
      ))}
      {mac && (
        <g className="px-person cursor-pointer" onClick={() => router.push(mac.href)} onMouseEnter={() => onHover(mac)} onMouseLeave={onLeave}>
          <rect x={macX - 4} y={macY - 8} width={42} height={42} fill="transparent" />
          <MacFace x={macX} y={macY} mood={mac.mood} />
          <Bubble p={mac} x={macX + 18} y={macY + 2} />
          <g className="px-cursor">
            <path d={`M${macX + 12} ${macY - 8}h10l-5 6z`} fill="#ffdf3d" stroke="#2a1e1a" strokeWidth={1} />
          </g>
          <PixelLabel x={macX - 17} y={macY + 26} text="MAC" />
        </g>
      )}
    </g>
  );
}

function Room({ room, x, y, onHover, onLeave }: { room: PixelRoom; x: number; y: number; onHover: (p: PixelPerson) => void; onLeave: () => void }) {
  const router = useRouter();
  const [f1, f2] = ROOM_FLOOR[room.name] || ["#ece6dc", "#e2dacd"];
  const studio = room.name === BIG_ROOM;
  const tiles: JSX.Element[] = [];
  for (let ty = 2; ty < 9; ty++)
    for (let tx = 0; tx < 12; tx++) {
      const tl = (tx + ty) % 2 ? f1 : f2;
      tiles.push(
        <g key={`${tx}-${ty}`}>
          {R(x + tx * TILE, y + ty * TILE, TILE, TILE, tl)}
          {R(x + tx * TILE, y + ty * TILE, TILE, 1, shade(tl, 0.35))}
          {R(x + tx * TILE, y + ty * TILE + TILE - 1, TILE, 1, shade(tl, -0.08))}
          {R(x + tx * TILE + TILE - 1, y + ty * TILE, 1, TILE, shade(tl, -0.08))}
        </g>,
      );
    }
  const slots = room.people.filter((p) => !p.device);
  const slotW = 60;
  const totalW = slots.length * slotW + (slots.length - 1) * 8;
  const startX = x + Math.max(8, (ROOM_W - totalW) / 2);
  const deskY = y + 4 * TILE + 26;
  const wall = studio ? "#6d7686" : "#a77c5a";
  const wallDark = shade(wall, -0.2);

  return (
    <g>
      {tiles}
      {/* 墙：摄影棚是吸音棉，其他房间是护墙板 */}
      {R(x, y, ROOM_W, 2 * TILE, wall)}
      {studio
        ? [...Array(24)].map((_, i) => <g key={"f" + i}>{[...Array(4)].map((__, j) => <g key={j}>{R(x + i * 8, y + j * 7 + 2, 7, 6, (i + j) % 2 ? "#5d6675" : "#747e8f")}</g>)}</g>)
        : [...Array(24)].map((_, i) => <g key={"p" + i}>{R(x + i * 8, y, 1, 2 * TILE, wallDark)}</g>)}
      {R(x, y + 2 * TILE - 5, ROOM_W, 5, studio ? "#3a4150" : "#7b573b")}
      {R(x, y + 2 * TILE - 5, ROOM_W, 1, studio ? "#59617a" : "#a07650")}
      {/* 窗：蓝天白云，木窗框 */}
      {R(x + 12, y + 4, 36, 21, "#f3efe6")}
      {R(x + 14, y + 6, 32, 6, "#7fc4ff")}
      {R(x + 14, y + 12, 32, 6, "#9fd6ff")}
      {R(x + 14, y + 18, 32, 5, "#c8e9ff")}
      {R(x + 29, y + 6, 2, 17, "#f3efe6")}
      {R(x + 16, y + 9, 10, 3, "#ffffff", "px-cloud", 0.85)}
      {R(x + 18, y + 7, 5, 2, "#ffffff", "px-cloud", 0.85)}
      {/* 钟 */}
      <circle cx={x + ROOM_W - 16} cy={y + 14} r={9} fill="#fffdf4" stroke="#3a2a20" strokeWidth={2} />
      {[[0, -7], [7, 0], [0, 7], [-7, 0]].map(([dx, dy]) => <g key={`${dx}${dy}`}>{R(x + ROOM_W - 16 + dx, y + 14 + dy, 1, 1, "#3a2a20")}</g>)}
      {R(x + ROOM_W - 16, y + 9, 1, 6, "#3a2a20")}
      {R(x + ROOM_W - 16, y + 14, 5, 1, "#c0392b", "px-hand")}
      {/* 房间名牌 */}
      {R(x + 60, y + 6, 72, 16, "#3a2a20")}
      {R(x + 62, y + 8, 68, 12, "#fff8e7")}
      <text x={x + 96} y={y + 17.5} textAnchor="middle" fontSize={9} fill="#3a2a20" className="px-font" fontWeight={700}>
        {room.name}
      </text>
      {/* 边框墙 */}
      <rect x={x} y={y} width={ROOM_W} height={ROOM_H} fill="none" stroke="#5e3b20" strokeWidth={3} />
      {/* 门 */}
      {R(x + ROOM_W / 2 - 12, y + ROOM_H - 3, 24, 4, f1)}

      {/* 装饰 */}
      {studio ? (
        <g>
          <OnAir x={x + 136} y={y + 8} />
          <Camera x={x + 12} y={y + 104} />
          <Softbox x={x + ROOM_W - 34} y={y + 104} />
          <RingLight x={x + 132} y={y + 108} />
        </g>
      ) : (
        <>
          <Plant x={x + 5} y={y + ROOM_H - 24} />
          {room.name === "出镜顾问" ? (
            <>
              <Camera x={x + ROOM_W - 48} y={y + ROOM_H - 44} />
              <Softbox x={x + 28} y={y + ROOM_H - 44} />
            </>
          ) : room.name === "销售部" ? (
            <ChartBoard x={x + ROOM_W - 46} y={y + ROOM_H - 42} />
          ) : room.name === "财务部" ? (
            <Cabinet x={x + ROOM_W - 40} y={y + ROOM_H - 38} />
          ) : room.name === "茶水间" ? (
            <Pantry x={x + 30} y={y + 62} />
          ) : room.name === "会议室" ? (
            <MeetingTable x={x + 40} y={y + 62} />
          ) : (
            <Shelf x={x + ROOM_W - 34} y={y + ROOM_H - 34} />
          )}
        </>
      )}

      {studio ? (
        <StudioSeats room={room} x={x} y={y} onHover={onHover} onLeave={onLeave} />
      ) : (
        slots.map((p, i) => {
          const sx = startX + i * (slotW + 8);
          if (p.seat)
            return (
              <g key={p.key} className="px-person cursor-pointer" onClick={() => router.push(p.href)} onMouseEnter={() => onHover(p)} onMouseLeave={onLeave}>
                <Chair x={sx + 34} y={deskY - 26} />
                <Desk x={sx} y={deskY} w={slotW} on={false} />
                <Board x={sx + 22} y={deskY - 42} label="招聘中" />
                <PixelLabel x={sx + slotW / 2} y={deskY + 14} text={p.name} />
              </g>
            );
          return <Worker key={p.key} p={p} x={sx} deskY={deskY} w={slotW} on={p.mood === "work" || p.mood === "happy"} screen="#c7f0c0" onHover={onHover} onLeave={onLeave} />;
        })
      )}
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
    for (let ty = 0; ty < 2; ty++)
      tiles.push(
        <g key={`${tx}-${ty}`}>
          {R(x + tx * TILE, y + ty * TILE, TILE, TILE, (tx + ty) % 2 ? "#cfc6b6" : "#c4baa8")}
          {R(x + tx * TILE, y + ty * TILE, TILE, 1, "#ded6c8")}
        </g>,
      );
  const pal = { O: "#3a2a20", C: "#f0a64a", c: "#d98a35", W: "#fff4e0", E: "#1a1420", P: "#f2a0a0" };
  return (
    <g>
      {tiles}
      {/* 办公室的猫：在走廊里走来走去 */}
      <g className="px-cat-walk" style={{ ["--hall" as any]: `${w - 30}px` }}>
        <g className="px-cat-flip">
          <Pixels
            x={x + 2}
            y={y + 7}
            pal={pal}
            rows={[
              "................O...O.",
              "O...............OCOOCO",
              "CO.............OCCCCCO",
              ".CO............OCECECO",
              ".COOOOOOOOOOOOOOCCPCCO",
              "..OCcCCcCCcCCcCCCWWWO.",
              "..OCCCCCCCCCCCCCWWWO..",
              "..OCCcCCcCCcCCCWWWCO..",
              "...OCCCCCCCCCCCCCCO...",
            ]}
          />
          <g className="px-frame-a">{R(x + 6, y + 16, 3, 4, "#d98a35")}{R(x + 17, y + 16, 3, 4, "#d98a35")}</g>
          <g className="px-frame-b">{R(x + 9, y + 16, 3, 4, "#d98a35")}{R(x + 14, y + 16, 3, 4, "#d98a35")}</g>
        </g>
      </g>
      {/* 饮水机 */}
      {R(x + w - 24, y + 10, 16, 20, "#e8eef5")}
      {R(x + w - 24, y + 10, 16, 2, "#ffffff")}
      {R(x + w - 21, y + 14, 3, 3, "#3b82f6")}
      {R(x + w - 14, y + 14, 3, 3, "#ef4444")}
      {R(x + w - 22, y - 8, 12, 18, "#8fd0ff")}
      {R(x + w - 20, y - 6, 3, 13, "#c8e9ff")}
    </g>
  );
}


// ---- Claude 巡视员（2026-11-03 Wallace：「把 Claude 的小人也加进去，到处走然后做一个巡视的动作，
// 鼠标点小人就显示，需要发布指令就到 Claude」）。原创造型：陶土色兜帽 + 记录板，不用任何官方标志。----
const CLAUDE_LOOK: Look = { hair: "#d4704f", skin: "#fbe3cf", shirt: "#d4704f", dark: "#a8483a", style: HOOD };

function ClaudePatrol({ x, y, w, onClick }: { x: number; y: number; w: number; onClick: () => void }) {
  const pal = { ...lookPal(CLAUDE_LOOK), K: "#a8483a" };
  return (
    <g className="px-person px-claude-walk cursor-pointer" style={{ ["--hall" as any]: `${w - 40}px` }} onClick={onClick}>
      <rect x={x} y={y - 14} width={30} height={50} fill="transparent" />
      <g className="px-claude-flip">
        <g className="px-bob">
          <Pixels rows={HEAD} pal={pal} x={x + 4} y={y - 14} />
          <Pixels rows={HOOD} pal={pal} x={x + 4} y={y - 14} />
          {/* 记录板 */}
          {R(x + 15, y + 4, 8, 9, "#8a5a33")}
          {R(x + 16, y + 5, 6, 7, "#fffdf4")}
          {R(x + 17, y + 7, 4, 1, "#8a8a99")}
          {R(x + 17, y + 9, 4, 1, "#8a8a99")}
          {R(x + 18, y + 3, 2, 2, "#c9ccd8")}
          {/* 裤子 + 迈步的腿 */}
          {R(x + 7, y + 12, 14, 4, "#3d4256")}
          <g className="px-frame-a">{R(x + 7, y + 16, 5, 6, "#3d4256")}{R(x + 16, y + 16, 5, 3, "#3d4256")}{R(x + 6, y + 21, 7, 2, "#2a1e1a")}{R(x + 15, y + 19, 7, 2, "#2a1e1a")}</g>
          <g className="px-frame-b">{R(x + 7, y + 16, 5, 3, "#3d4256")}{R(x + 16, y + 16, 5, 6, "#3d4256")}{R(x + 6, y + 19, 7, 2, "#2a1e1a")}{R(x + 15, y + 21, 7, 2, "#2a1e1a")}</g>
        </g>
      </g>
      {/* 巡视：停下来的时候头上冒「✓」 */}
      <g className="px-claude-check">
        <rect x={x + 20} y={y - 30} width={14} height={13} fill="#fff" stroke="#2a1e1a" strokeWidth={1.5} />
        <path d={`M${x + 23} ${y - 24}l3 3l5 -6`} stroke="#2f9e57" strokeWidth={2} fill="none" />
      </g>
      <g className="px-cursor"><PixelLabel x={x + 14} y={y - 18} text="Claude" /></g>
    </g>
  );
}

// ---- 市场部流水线（2026-11-06 Wallace：「做一个流水线的动画吧，每个人的职责都以动画形式呈现」）----
// 一条传送带：Mark 写稿 → IP 拍摄 → Drive → Leo 剪辑 → Chase 发布 → Ivy 检查。一件「货」沿着传送带走，
// 每到一站变个样子（稿纸 → 胶片 → 云文件 → 成片 → 手机 → ✓）。哪一站的人头上冒「!」，货就停在那一站闪红。
type Station = { key: string; label: string; who?: string };
const STATIONS: Station[] = [
  { key: "script", label: "Mark 写稿", who: "mark" },
  { key: "shoot", label: "IP 拍摄" },
  { key: "drive", label: "Drive · 编号" },
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

function Conveyor({ x, y, w, people, shootStuck, driveStuck }: { x: number; y: number; w: number; people: PixelPerson[]; shootStuck?: string | null; driveStuck?: string | null }) {
  const n = STATIONS.length;
  const gap = (w - 40) / (n - 1);
  const sx = (i: number) => x + 20 + i * gap;
  const mood = (who?: string) => people.find((p) => p.key === who)?.mood;
  // 拍摄提醒（稿给了 IP、2 天没新原片）：货停在「IP 拍摄」那站，不算在 Mark 头上
  // 视频编号对不上稿（Mark 整理 Drive）：货停在「传 Drive」那站
  const stuck = shootStuck ? 1 : driveStuck ? 2 : STATIONS.findIndex((st) => st.who && mood(st.who) === "alert");
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
        const bad = (st.key === "shoot" && !!shootStuck) || (st.key === "drive" && !!driveStuck) || (!shootStuck && !driveStuck && st.who && mood(st.who) === "alert");
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

const BELT_H = 74;

function Map({ rooms: real, cols, onHover, onLeave, onClaude }: { rooms: PixelRoom[]; cols: number; onHover: (p: PixelPerson) => void; onLeave: () => void; onClaude: () => void }) {
  // 最后一排没坐满就补一间会议室（agent 请求开会就是约在这里）
  const rooms = [...real];
  for (const filler of ["会议室", "茶水间"]) if (rooms.length % cols) rooms.push({ name: filler, people: [] });
  const rows = Math.ceil(rooms.length / cols);
  const W = cols * ROOM_W + (cols + 1) * 8;
  const H0 = rows * ROOM_H + (rows - 1) * HALL + 16;
  const mkt = real.find((r) => r.name === BIG_ROOM);
  const H = H0 + (mkt ? BELT_H : 0);
  const w = W - 16;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" shapeRendering="crispEdges" role="img" aria-label="WWFS办公室像素地图">
      <rect width={W} height={H} fill="#7a5a3f" />
      {[...Array(rows - 1)].map((_, r) => (
        <Hall key={r} x={8} y={8 + (r + 1) * ROOM_H + r * HALL} w={W - 16} />
      ))}
      {rooms.map((room, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        return <Room key={room.name} room={room} x={8 + c * (ROOM_W + 8)} y={8 + r * (ROOM_H + HALL)} onHover={onHover} onLeave={onLeave} />;
      })}
      {rows > 1 && <ClaudePatrol x={14} y={8 + ROOM_H + 10} w={W - 28} onClick={onClaude} />}
      {mkt && (
        <g>
          <Conveyor x={8} y={H0 + 8} w={w} people={mkt.people} shootStuck={mkt.shootStuck} driveStuck={mkt.driveStuck} />
          {mkt.driveStuck && (
            <text x={8 + 20 + (2 * (w - 40)) / 5} y={H0 + 68} textAnchor="middle" fontSize={6} fill="#ffe3e3" className="px-font">
              {mkt.driveStuck}
            </text>
          )}
          {mkt.shootStuck && (
            <text x={8 + 20 + (w - 40) / 5} y={H0 + 68} textAnchor="middle" fontSize={6} fill="#ffe3e3" className="px-font">
              {mkt.shootStuck}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

const CLAUDE_TEXT = "我是 Claude，正在各部门巡视：谁在岗、谁卡住了，这里都看得到。\n这里只看反馈；要给哪位同事交代事情，到 Claude 里跟我说。";
const WELCOME = "欢迎来到 WWFS办公室！鼠标放在同事身上看他的定时任务和在干什么，头上有「!」就是卡住了。点一下看详细反馈。";

export default function PixelOffice({ rooms }: { rooms: PixelRoom[] }) {
  const [who, setWho] = useState<PixelPerson | null>(null);
  const [claude, setClaude] = useState(false);
  const full = useMemo(() => {
    if (!who && claude) return CLAUDE_TEXT;
    if (!who) return WELCOME;
    if (who.seat) return `${who.name}：${who.title}。这个位子还空着，宣发移交的客户先放在看板「移交销售」。`;
    const lines = [`${who.name}（${who.title}${who.tags ? " · " + who.tags.replace(/,/g, "/") : ""}）· ${who.statusLabel}`];
    // 2026-11-03 Wallace：「感叹号证明卡住了，鼠标滑到这个人身上的时候，显示这个人的定时任务和周期」
    if (who.mood === "alert" && who.stuck) lines.push(`❗ ${who.stuck}`);
    if (who.schedule || who.every) lines.push(`⏰ 定时任务：${who.schedule || "未填"}${who.every ? " · " + who.every : ""}${who.host ? " · " + who.host : ""}`);
    if (who.lastRun !== undefined) lines.push(`🕘 上次运行：${who.lastRun || "还没打过卡"}`);
    lines.push(who.task ? `正在：${who.task}` : "手上没事。");
    if (who.unread) lines.push(`你有 ${who.unread} 条留言他还没看。`);
    return lines.join("\n");
  }, [who, claude]);
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
  return (
    <div className="px-office relative rounded-2xl overflow-hidden border-4 border-[#3a2a20] shadow-xl bg-[#7a5a3f]">
      <div className="relative">
        <div className="hidden md:block">
          <Map rooms={rooms} cols={3} onHover={setWho} onLeave={leave} onClaude={() => setClaude(true)} />
        </div>
        <div className="md:hidden">
          <Map rooms={rooms} cols={2} onHover={setWho} onLeave={leave} onClaude={() => setClaude(true)} />
        </div>
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
    <svg viewBox="-3 -14 30 40" width={size} height={(size * 40) / 30} shapeRendering="crispEdges" className="px-office shrink-0" aria-hidden>
      <Person p={p} x={0} y={0} />
      <Bubble p={p} x={6} y={2} />
    </svg>
  );
}
