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
type Look = { hair: string; skin: string; shirt: string; dark: string; style: string[]; outfit?: string[]; glasses?: boolean; extra?: Record<string, string>; head?: string[]; eyeY?: number; mouthY?: number };

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
// Chase（2026-11-09 Wallace：「是一个小宝宝的形象，我儿子的名字命名的，最标志的点是带着一个菠萝的毛线帽」）：
// 圆脸大眼、连体衣，头上黄色菠萝针织帽，帽顶一簇绿叶。整张图一层画完，五官比大人低。
const BABY_PINEAPPLE = [
  "......g..GG..g......",
  ".....gG.gGGg.Gg.....",
  "......GGgGGgGG......",
  ".......GGGGGG.......",
  ".....OOOOOOOOOO.....",
  "...OOYYyYYYYyYYOO...",
  "..OYYyYyYYyYyYYYYO..",
  "..OYyYYYyyYYYyYYYO..",
  "..OyYYYyYYyYYYyYYO..",
  "..OYyYyYYYYyYyYYYO..",
  "..OTtTtTtTtTtTtTtO..",
  "..OSSSSSSSSSSSSSSO..",
  "..OSSSSSSSSSSSSSSO..",
  "..OSSSWESSSSWESSSO..",
  "..OSSSEESSSSEESSSO..",
  "..OSBBSSSssSSSBBSO..",
  "...OSSSSSMMSSSSSO...",
  "....OOSSSSSSSSOO....",
  "......OOOOOOOO......",
  ".....OCCCCCCCCO.....",
  "....OCCCWWWWCCCO....",
  "....OCcCWWWWCcCO....",
  "....OCcCWWWWCcCO....",
  "....OCcCCCCCCcCO....",
  "....OCcCCCCCCcCO....",
  "....OCcCCCCCCcCO....",
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
  // Chase 发布：戴菠萝毛线帽的小宝宝
  mac: { hair: "#c9891a", skin: "#fbdcc4", shirt: "#9ad9c0", dark: "#6fb89d", style: [], head: BABY_PINEAPPLE, eyeY: 13, mouthY: 16, extra: { G: "#3f9d55", g: "#67c174", Y: "#f6c945", y: "#d99a1e", T: "#c9891a", t: "#e8b03a" } },
  // Ivy 检查：格子侦探帽、驼色风衣
  inspector: { hair: "#5a3a22", skin: "#f8d5b8", shirt: "#c69a5b", dark: "#6e4f28", style: HAT_DETECTIVE, outfit: TRENCH, extra: { K: "#8a6a44", Y: "#5c4329", X: "#6e5233", L: "#ddb981", o: "#3a2a20" } },
  // Wallace 老板：侧分短发、深灰西装
  wallace: { hair: "#22222c", skin: "#f3c8a4", shirt: "#33363f", dark: "#2f9e57", style: HAIR_SIDE, outfit: SUIT, extra: { L: "#4d5160", o: "#c9ccd8" } },
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
  const ey = y + (L.eyeY ?? 8);
  const my = y + (L.mouthY ?? 12);
  return (
    <g className={"px-bob " + (asleep ? "px-slow" : "")}>
      <Pixels rows={L.head || HEAD} pal={pal} x={x} y={y} />
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
      {p.mood === "happy" && <>{R(x + 8, my, 4, 2, "#b5525a")}{R(x + 9, my, 2, 1, "#ffffff")}</>}
      {p.mood === "alert" && <>{R(x + 8, my, 4, 1, L.skin)}{R(x + 9, my, 2, 2, "#7a2f35")}</>}
      {asleep ? (
        <g>
          {R(x + 6, ey, 2, 2, L.skin)}
          {R(x + 12, ey, 2, 2, L.skin)}
          {R(x + 6, ey + 1, 2, 1, "#1a1420")}
          {R(x + 12, ey + 1, 2, 1, "#1a1420")}
        </g>
      ) : (
        <g className="px-blink">
          {R(x + 6, ey, 2, 2, L.skin)}
          {R(x + 12, ey, 2, 2, L.skin)}
          {R(x + 6, ey + 1, 2, 1, "#1a1420")}
          {R(x + 12, ey + 1, 2, 1, "#1a1420")}
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
function Desk({ x, y, w, on, screen, exec, job }: { x: number; y: number; w: number; on: boolean; screen?: string; exec?: boolean; job?: string }) {
  const lit = on ? screen || "#a7e3ff" : "#30303c";
  const kx = x + seatX(w) + 2;
  const [top, topHi, grain, front, frontLn, seam, leg] = exec
    ? ["#6b3a24", "#8a5233", "#5a2f1c", "#4f2a19", "#3e2013", "#5f3522", "#2e180e"]
    : ["#c8935a", "#dfb07a", "#b98248", "#9c6a3c", "#7a4f2a", "#8a5c33", "#6b4426"];
  return (
    <g>
      {R(x, y, w, 5, top)}
      {R(x, y, w, 1, topHi)}
      {R(x + 6, y + 2, 7, 1, grain)}
      {R(x + w - 12, y + 3, 8, 1, grain)}
      {R(x, y + 5, w, 11, front)}
      {R(x, y + 5, w, 1, frontLn)}
      {R(x + 3, y + 8, w - 6, 1, seam)}
      {R(x + 3, y + 13, w - 6, 1, seam)}
      {R(x, y + 16, w, 1, frontLn)}
      {R(x + 2, y + 17, 3, 6, leg)}
      {R(x + w - 5, y + 17, 3, 6, leg)}
      {/* 显示器 */}
      {R(x + 2, y - 15, 19, 13, "#23232d")}
      {R(x + 3, y - 14, 17, 10, lit, on ? "px-screen" : undefined)}
      {on && <ScreenJob job={job || ""} x={x + 3} y={y - 14} />}
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
      {[8, 11, 14, 17].map((d, i) => <g key={d}>{R(x + d, y + 28, 2, 1, "#8a8a96")}{mood !== "alert" && mood !== "sleep" && <rect x={x + d} y={y + 28} width={2} height={1} fill="#4dff8a"><Steps attr="opacity" values={[...Array(4)].map((_, t) => (t === i ? 1 : 0))} dur={0.8} /></rect>}</g>)}
      {/* 机器在转：齿轮转、屏幕右下角进度走 */}
      {mood !== "alert" && mood !== "sleep" && (
        <g>
          <g className="px-spin">
            {[0, 1, 2, 3].map((k) => <rect key={k} x={x + 39} y={y + 1} width={4} height={18} fill="#8a8a96" transform={`rotate(${k * 45} ${x + 41} ${y + 10})`} />)}
            <circle cx={x + 41} cy={y + 10} r={6} fill="#a9a9b4" stroke="#55555f" strokeWidth={1} />
            <circle cx={x + 41} cy={y + 10} r={2} fill="#ececf2" />
          </g>
          {R(x + 4, y + 17, 26, 1, "#6fa3cf")}
          <rect x={x + 4} y={y + 17} width={26} height={1} fill="#ffffff">
            <animate attributeName="width" from={0} to={26} dur="2.5s" repeatCount="indefinite" />
          </rect>
        </g>
      )}
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

// ---- 工作动画（2026-11-09 Wallace：「所有任务的动画要反应工作特征，比如 Mark 是写稿的，Chase 是分发的，Leo 是剪辑的，Ivy 是巡检的」）----
// 屏幕内容 + 桌上的东西都跟这个人的活有关；卡住（!）的时候全停，屏幕黑掉。
const Steps = ({ attr, values, dur, begin }: { attr: string; values: (string | number)[]; dur: number; begin?: string }) => (
  <animate attributeName={attr} values={values.join(";")} dur={`${dur}s`} begin={begin} calcMode="discrete" repeatCount="indefinite" />
);

/** 从 0 长到 w：第 start 拍开始，占 span 拍，一圈 total 拍。 */
function growValues(w: number, start: number, span: number, total: number) {
  return [...Array(total)].map((_, t) => Math.round(Math.max(0, Math.min(1, (t - start + 1) / span)) * w));
}

/** 显示器里的画面，17×10。 */
function ScreenJob({ job, x, y }: { job: string; x: number; y: number }) {
  switch (job) {
    case "mark": // 文档一行行打出来
      return (
        <g>
          {R(x, y, 17, 10, "#fffdf4")}
          {[12, 15, 9, 13].map((w, i) => (
            <rect key={i} x={x + 2} y={y + 1 + i * 2} width={w} height={1} fill={i === 0 ? "#d4704f" : "#3a3a46"}>
              <Steps attr="width" values={growValues(w, i * 3, 3, 14)} dur={4.2} />
            </rect>
          ))}
        </g>
      );
    case "leo": // 上面是预览，下面是时间线，播放头在走，有一段被剪掉
      return (
        <g>
          {R(x, y, 17, 10, "#1f1f28")}
          {R(x + 5, y + 1, 7, 5, "#7fc3ff")}
          <path d={`M${x + 7} ${y + 2}l3 1.5l-3 1.5z`} fill="#fff" />
          {R(x + 1, y + 7, 5, 2, "#e0704f")}
          {R(x + 7, y + 7, 3, 2, "#f2c230")}
          <rect x={x + 10} y={y + 7} width={3} height={2} fill="#ff5a5a">
            <Steps attr="opacity" values={[1, 1, 1, 0.3, 0, 0]} dur={3} />
          </rect>
          {R(x + 13, y + 7, 3, 2, "#55c1ff")}
          <rect x={x + 1} y={y + 6} width={1} height={4} fill="#ffffff">
            <animate attributeName="x" from={x + 1} to={x + 15} dur="3s" repeatCount="indefinite" />
          </rect>
        </g>
      );
    case "mac": // 三条上传进度
      return (
        <g>
          {R(x, y, 17, 10, "#eaf3ff")}
          {[0, 1, 2].map((i) => (
            <g key={i}>
              {R(x + 2, y + 1 + i * 3, 13, 2, "#c8d3e2")}
              <rect x={x + 2} y={y + 1 + i * 3} width={13} height={2} fill={["#ff6a8a", "#ff7a3d", "#4f9dff"][i]}>
                <Steps attr="width" values={growValues(13, i * 2, 4, 9)} dur={3} />
              </rect>
            </g>
          ))}
        </g>
      );
    case "inspector": // 检查清单，一项项打勾
      return (
        <g>
          {R(x, y, 17, 10, "#f4fff4")}
          {[0, 1, 2].map((i) => (
            <g key={i}>
              {R(x + 6, y + 2 + i * 3, 9, 1, "#3a3a46")}
              <rect x={x + 2} y={y + 1 + i * 3} width={2} height={2} fill="#2f9e57">
                <Steps attr="opacity" values={[...Array(6)].map((_, t) => (t > i ? 1 : 0))} dur={3.6} />
              </rect>
            </g>
          ))}
        </g>
      );
    case "wallace": // 看反馈：柱子一根根长起来
      return (
        <g>
          {R(x, y, 17, 10, "#f7fbff")}
          {[3, 5, 4, 7].map((h, i) => (
            <rect key={i} x={x + 2 + i * 4} y={y + 9 - h} width={2} height={h} fill={i === 3 ? "#2f9e57" : "#7aa8e0"}>
              <Steps attr="opacity" values={[...Array(5)].map((_, t) => (t >= i ? 1 : 0))} dur={4} />
            </rect>
          ))}
        </g>
      );
    case "amelia": // 日程表，格子一个个排上
      return (
        <g>
          {R(x, y, 17, 10, "#fff5fa")}
          {R(x, y, 17, 2, "#ec5f9e")}
          {[...Array(10)].map((_, i) => (
            <rect key={i} x={x + 1 + (i % 5) * 3} y={y + 3 + Math.floor(i / 5) * 3} width={2} height={2} fill={i % 3 ? "#f5a8ca" : "#7a6bd6"}>
              <Steps attr="opacity" values={[...Array(11)].map((_, t) => (t >= i ? 1 : 0.15))} dur={5} />
            </rect>
          ))}
        </g>
      );
    case "bob": // 客户名单，一行行成交变绿
      return (
        <g>
          {R(x, y, 17, 10, "#f4f7ff")}
          {[0, 1, 2].map((i) => (
            <g key={i}>
              {R(x + 2, y + 2 + i * 3, 9, 1, "#3a3a46")}
              <rect x={x + 13} y={y + 1 + i * 3} width={3} height={2} fill="#2f9e57">
                <Steps attr="fill" values={[...Array(6)].map((_, t) => (t > i * 2 ? "#2f9e57" : "#c8d3e2"))} dur={4.8} />
              </rect>
            </g>
          ))}
        </g>
      );
    case "tina": // 电子表格，光标一格格走
      return (
        <g>
          {R(x, y, 17, 10, "#ffffff")}
          {[3, 6, 9].map((d) => <g key={d}>{R(x, y + d, 17, 1, "#c7e3d0")}</g>)}
          {[5, 11].map((d) => <g key={d}>{R(x + d, y, 1, 10, "#c7e3d0")}</g>)}
          <rect x={x + 6} y={y + 1} width={5} height={2} fill="#2f9e57">
            <Steps attr="y" values={[y + 1, y + 4, y + 7]} dur={2.4} />
            <Steps attr="x" values={[x + 6, x + 12]} dur={1.6} />
          </rect>
        </g>
      );
    default:
      return (
        <g>
          {R(x + 1, y + 1, 9, 1, "#2f5f8f")}
          {R(x + 1, y + 3, 13, 1, "#2f5f8f")}
          {R(x + 1, y + 5, 6, 1, "#e0704f")}
          {R(x + 1, y + 7, 11, 1, "#2f5f8f")}
        </g>
      );
  }
}

/** 一样东西从 from 划弧线飞到 to，dur 秒一趟。 */
function Flyer({ from, to, dur, begin, children }: { from: [number, number]; to: [number, number]; dur: number; begin?: string; children: React.ReactNode }) {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  return (
    <g transform={`translate(${from[0]} ${from[1]})`}>
      <g opacity={0}>
        <animateMotion path={`M0 0Q${dx / 2} ${dy / 2 - 16} ${dx} ${dy}`} dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.9;1" dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
        {children}
      </g>
    </g>
  );
}
const VideoCard = () => <>{R(0, 0, 8, 6, "#e0504a")}<path d="M3 1.5l3 1.5l-3 1.5z" fill="#fff" />{R(0, 0, 8, 1, "#ff8a80")}</>;
const Sheet = () => <>{R(0, 0, 6, 8, "#fffdf4")}{R(1, 2, 4, 1, "#8a8a99")}{R(1, 4, 4, 1, "#8a8a99")}{R(1, 6, 3, 1, "#8a8a99")}</>;

/** 桌上和头顶跟工作有关的东西。x 是桌子左边，y 是桌面，px/py 是人。 */
function JobProps({ job, x, y, w, px, py }: { job: string; x: number; y: number; w: number; px: number; py: number }) {
  const right = x + w - 10;
  switch (job) {
    case "mark": // 写好的稿一张张叠起来
      return (
        <g>
          <rect x={right} y={y - 12} width={8} height={12} fill="#fffdf4">
            <Steps attr="height" values={[2, 4, 6, 8, 10, 12]} dur={6} />
            <Steps attr="y" values={[y - 2, y - 4, y - 6, y - 8, y - 10, y - 12]} dur={6} />
          </rect>
          {R(right, y - 1, 8, 1, "#b9b9c2")}
          <Flyer from={[px + 8, y - 8]} to={[right + 1, y - 14]} dur={1.5}><Sheet /></Flyer>
        </g>
      );
    case "leo": // 胶片和剪刀，一小段被剪下来掉到桌上
      return (
        <g>
          {R(right - 2, y - 15, 12, 7, "#2d2d3a")}
          {[0, 3, 6, 9].map((d) => <g key={d}>{R(right - 1 + d, y - 14, 1, 1, "#fffdf4")}{R(right - 1 + d, y - 10, 1, 1, "#fffdf4")}</g>)}
          {R(right, y - 13, 8, 3, "#e0704f")}
          <g className="px-frame-a"><path d={`M${right + 3} ${y - 22}l2 8M${right + 7} ${y - 22}l-2 8`} stroke="#c9ccd8" strokeWidth={1.5} /></g>
          <g className="px-frame-b"><path d={`M${right + 1} ${y - 21}l4 7M${right + 9} ${y - 21}l-4 7`} stroke="#c9ccd8" strokeWidth={1.5} /></g>
          <rect x={right + 6} y={y - 13} width={3} height={3} fill="#ff5a5a">
            <Steps attr="y" values={[y - 13, y - 13, y - 9, y - 6, y - 3]} dur={2} />
          </rect>
        </g>
      );
    case "mac": { // Chase：把成片丢给三台手机
      const phones = [px - 22, px + 2, px + 26];
      const py2 = y - 42;
      return (
        <g>
          {R(phones[0] - 3, py2 + 13, phones[2] - phones[0] + 15, 2, "#8a5a33")}
          {phones.map((fx, i) => (
            <g key={fx}>
              {R(fx, py2, 9, 13, "#1f1f28")}
              <rect x={fx + 1} y={py2 + 1} width={7} height={10} fill={["#ffb3c7", "#ffd2a8", "#b9dcff"][i]}>
                <animate attributeName="fill" values={`${["#ffb3c7", "#ffd2a8", "#b9dcff"][i]};#ff5a5a`} keyTimes="0;0.8" dur="2.4s" begin={`${-i * 0.8}s`} calcMode="discrete" repeatCount="indefinite" />
              </rect>
              <Flyer from={[px + 6, y - 12]} to={[fx, py2 + 3]} dur={2.4} begin={`${-i * 0.8}s`}><VideoCard /></Flyer>
            </g>
          ))}
        </g>
      );
    }
    case "wallace": // 助理送来的报告
      return (
        <g>
          {R(right - 8, y - 3, 12, 3, "#fffdf4")}
          {R(right - 7, y - 5, 12, 2, "#f2e4b8")}
          {R(right + 7, y - 6, 5, 6, "#fffdf4")}
        </g>
      );
    case "amelia":
      return (
        <g>
          {R(right, y - 7, 8, 7, "#ffe27a")}
          {R(right + 1, y - 5, 6, 1, "#b08a2c")}
          {R(right + 1, y - 3, 4, 1, "#b08a2c")}
        </g>
      );
    case "bob": // 打电话，说着说着就成交
      return (
        <g>
          {R(px + 17, py + 6, 3, 11, "#23232d")}
          {R(px + 15, py + 6, 4, 3, "#23232d")}
          {R(px + 15, py + 14, 4, 3, "#23232d")}
          {R(right, y - 5, 9, 5, "#23232d")}
          {R(right + 2, y - 4, 5, 2, "#7fc3ff", "px-rec")}
          <g>
            <Steps attr="opacity" values={[0, 1, 1, 0]} dur={2.4} />
            {R(px + 22, py - 6, 16, 11, "#ffffff")}
            {R(px + 22, py + 5, 3, 3, "#ffffff")}
            <text x={px + 30} y={py + 3} textAnchor="middle" fontSize={8} fill="#2f9e57" className="px-font" fontWeight={700}>$</text>
          </g>
        </g>
      );
    case "tina": // 计算器吐出长长的账单
      return (
        <g>
          <rect x={right + 1} y={y - 22} width={6} height={13} fill="#fffdf4">
            <Steps attr="height" values={[2, 5, 8, 11, 13]} dur={3.5} />
            <Steps attr="y" values={[y - 11, y - 14, y - 17, y - 20, y - 22]} dur={3.5} />
          </rect>
          {R(right, y - 9, 9, 9, "#55606e")}
          {R(right + 1, y - 8, 7, 2, "#c7f0c0")}
          {[0, 3, 6].map((d) => <g key={d}>{R(right + 1 + d, y - 5, 2, 1, "#e6e6ec", "px-rec")}{R(right + 1 + d, y - 3, 2, 1, "#e6e6ec")}</g>)}
        </g>
      );
    default:
      return null;
  }
}

/** Ivy 巡检：离开座位，拿着放大镜和记录板一张桌一张桌查，查完打勾。 */
function IvyPatrol({ p, stops, y, onHover, onLeave }: { p: PixelPerson; stops: number[]; y: number; onHover: (p: PixelPerson) => void; onLeave: () => void }) {
  const router = useRouter();
  const STAY = 1.5, WALK = 1;
  const legs = [...stops, stops[0]];
  const T = stops.length * STAY + (legs.length - 1) * WALK;
  const times: number[] = [], xs: number[] = [], ok: number[] = [];
  let t = 0;
  stops.forEach((sx, i) => {
    times.push(t / T); xs.push(sx - stops[0]); ok.push(1);
    t += STAY;
    times.push(t / T); xs.push(sx - stops[0]); ok.push(0);
    t += WALK;
    void i;
  });
  times.push(1); xs.push(0); ok.push(0);
  const x = stops[0];
  return (
    <g className="px-person cursor-pointer" onClick={() => router.push(p.href)} onMouseEnter={() => onHover(p)} onMouseLeave={onLeave}>
      <animateTransform attributeName="transform" type="translate" dur={`${T}s`} repeatCount="indefinite" keyTimes={times.map((v) => v.toFixed(4)).join(";")} values={xs.map((v) => `${v} 0`).join(";")} />
      <rect x={x - 6} y={y - 12} width={36} height={52} fill="transparent" />
      <Person p={p} x={x} y={y} />
      {R(x + 3, y + 26, 14, 3, "#6e4f28")}
      <g className="px-frame-a">{R(x + 4, y + 29, 5, 6, "#3d4256")}{R(x + 11, y + 29, 5, 3, "#3d4256")}{R(x + 3, y + 35, 7, 2, "#2a1e1a")}{R(x + 10, y + 32, 7, 2, "#2a1e1a")}</g>
      <g className="px-frame-b">{R(x + 4, y + 29, 5, 3, "#3d4256")}{R(x + 11, y + 29, 5, 6, "#3d4256")}{R(x + 3, y + 32, 7, 2, "#2a1e1a")}{R(x + 10, y + 35, 7, 2, "#2a1e1a")}</g>
      {/* 记录板 */}
      {R(x - 5, y + 17, 9, 11, "#8a5a33")}
      {R(x - 4, y + 18, 7, 9, "#fffdf4")}
      {R(x - 3, y + 20, 5, 1, "#8a8a99")}
      {R(x - 3, y + 23, 5, 1, "#8a8a99")}
      {/* 放大镜 */}
      <circle cx={x + 25} cy={y + 12} r={5} fill="#cfeaff" stroke="#3a2a20" strokeWidth={2} className="px-bang" />
      <path d={`M${x + 21} ${y + 16}l-4 5`} stroke="#6b4426" strokeWidth={2.5} />
      <g opacity={0}>
        <animate attributeName="opacity" dur={`${T}s`} repeatCount="indefinite" calcMode="discrete" keyTimes={times.map((v) => v.toFixed(4)).join(";")} values={ok.join(";")} />
        <rect x={x + 16} y={y - 16} width={14} height={13} fill="#fff" stroke="#2a1e1a" strokeWidth={1.5} />
        <path d={`M${x + 19} ${y - 10}l3 3l5 -6`} stroke="#2f9e57" strokeWidth={2} fill="none" />
      </g>
      <Bubble p={p} x={x + 3} y={y + 2} />
    </g>
  );
}

// 2026-11-09 Wallace：「不要把每个办公室都设计的一样，人多就大一点」：每间房自己的墙、地面、家具，大小按人数分
type RoomLook = { floor: [string, string]; kind: "tile" | "carpet" | "parquet" | "checker"; wall: string; wallKind: "foam" | "panel" | "paint" | "glass" | "subway"; trim: string };
const ROOM_LOOK: Record<string, RoomLook> = {
  市场部: { floor: ["#d7e8f7", "#c9def2"], kind: "tile", wall: "#6d7686", wallKind: "foam", trim: "#3a4150" },
  老板办公室: { floor: ["#3f6360", "#4c7572"], kind: "carpet", wall: "#5e3c27", wallKind: "panel", trim: "#3a2416" },
  销售部: { floor: ["#c9d6ee", "#aebfe0"], kind: "carpet", wall: "#2f62b8", wallKind: "paint", trim: "#1f4488" },
  财务部: { floor: ["#d9b98a", "#c9a673"], kind: "parquet", wall: "#6f9a82", wallKind: "paint", trim: "#4c7560" },
  会议室: { floor: ["#c3c7cd", "#a9aeb6"], kind: "carpet", wall: "#dfe7ee", wallKind: "glass", trim: "#8a96a3" },
  茶水间: { floor: ["#fbf3df", "#e7a46b"], kind: "checker", wall: "#7fc4b8", wallKind: "subway", trim: "#4e9488" },
};
const DEFAULT_LOOK: RoomLook = { floor: ["#ece6dc", "#e2dacd"], kind: "tile", wall: "#a77c5a", wallKind: "paint", trim: "#7b573b" };

const TILE = 16;
const WALL_H = 2 * TILE;
const HALL = 2 * TILE;
const BIG_ROOM = "市场部";
const BOSS_ROOM = "老板办公室";
// 2026-11-09 Wallace：「排序是 Mark-Leo-Chase-Ivy，四个人的电脑都连接到 MAC」
const SEAT_ORDER = ["mark", "leo", "mac", "inspector"];

function Floor({ look, x, y, w, h }: { look: RoomLook; x: number; y: number; w: number; h: number }) {
  const [a, b] = look.floor;
  const out: JSX.Element[] = [R(x, y, w, h, a)].map((e) => <g key="base">{e}</g>);
  const push = (k: string, e: JSX.Element) => out.push(<g key={k}>{e}</g>);
  if (look.kind === "carpet") {
    for (let i = 0; i < (w * h) / 40; i++) push(`d${i}`, R(x + ((i * 37) % w), y + ((i * 53) % h), 1, 1, b));
  } else if (look.kind === "parquet") {
    for (let r = 0; r * 8 < h; r++) {
      const py = y + r * 8;
      push(`r${r}`, R(x, py, w, 8, r % 2 ? a : b));
      push(`l${r}`, R(x, py + 7, w, 1, shade(a, -0.2)));
      for (let c = r % 2 ? 12 : 28; c < w; c += 32) push(`s${r}-${c}`, R(x + c, py, 1, 8, shade(a, -0.2)));
    }
  } else {
    const size = look.kind === "checker" ? 12 : TILE;
    for (let r = 0; r * size < h; r++)
      for (let c = 0; c * size < w; c++) {
        const col = (r + c) % 2 ? a : b;
        const cw = Math.min(size, w - c * size), ch = Math.min(size, h - r * size);
        push(`${r}-${c}`, R(x + c * size, y + r * size, cw, ch, col));
        if (look.kind === "tile") {
          push(`t${r}-${c}`, R(x + c * size, y + r * size, cw, 1, shade(col, 0.35)));
          if (ch === size) push(`u${r}-${c}`, R(x + c * size, y + r * size + size - 1, cw, 1, shade(col, -0.08)));
        }
      }
  }
  return <g>{out}</g>;
}

function Wall({ look, x, y, w }: { look: RoomLook; x: number; y: number; w: number }) {
  const out: JSX.Element[] = [];
  const push = (k: string, e: JSX.Element) => out.push(<g key={k}>{e}</g>);
  const dark = shade(look.wall, -0.18);
  if (look.wallKind === "foam") {
    for (let i = 0; i * 8 < w; i++) for (let j = 0; j < 4; j++) push(`${i}-${j}`, R(x + i * 8, y + j * 7 + 2, Math.min(7, w - i * 8), 6, (i + j) % 2 ? "#5d6675" : "#747e8f"));
  } else if (look.wallKind === "panel") {
    for (let i = 0; i * 24 < w; i++) {
      push(`p${i}`, R(x + i * 24 + 3, y + 4, Math.min(18, w - i * 24 - 3), 21, shade(look.wall, 0.1)));
      push(`q${i}`, R(x + i * 24 + 5, y + 6, Math.max(0, Math.min(14, w - i * 24 - 5)), 17, dark));
    }
  } else if (look.wallKind === "glass") {
    push("g", R(x, y + 3, w, 24, "#eef6fb"));
    for (let i = 0; i * 30 < w; i++) {
      push(`m${i}`, R(x + i * 30, y, 2, WALL_H, look.trim));
      push(`f${i}`, R(x + i * 30 + 6, y + 12, Math.max(0, Math.min(20, w - i * 30 - 6)), 6, "#cfdde8"));
    }
  } else if (look.wallKind === "subway") {
    for (let r = 0; r < 4; r++)
      for (let c = r % 2 ? -8 : 0; c < w; c += 16) {
        const cx = Math.max(0, c);
        push(`${r}-${c}`, R(x + cx, y + r * 7, Math.max(0, Math.min(c + 15 - cx, w - cx)), 6, r % 2 ? look.wall : shade(look.wall, 0.15)));
      }
  } else {
    push("b", R(x, y, w, 7, dark));
    push("c", R(x, y + 7, w, 1, shade(look.wall, 0.3)));
  }
  return <g>{out}</g>;
}

/** 窗：city 是老板办公室的落地大窗，看得到楼。 */
function Window({ x, y, w, city }: { x: number; y: number; w: number; city?: boolean }) {
  const inner = w - 4;
  return (
    <g>
      {R(x, y, w, 21, city ? "#2a1a10" : "#f3efe6")}
      {R(x + 2, y + 2, inner, 6, "#7fc4ff")}
      {R(x + 2, y + 8, inner, 6, "#9fd6ff")}
      {R(x + 2, y + 14, inner, 5, "#c8e9ff")}
      {city
        ? [[4, 10, 8], [16, 7, 13], [26, 12, 6], [42, 8, 11], [54, 11, 7], [66, 6, 12]].filter(([d]) => d < inner - 6).map(([d, bw, bh]) => (
            <g key={d}>
              {R(x + d, y + 19 - bh, Math.min(bw, inner - d), bh, "#5b6f8c")}
              {R(x + d + 2, y + 21 - bh, 1, 1, "#ffe08a")}
              {R(x + d + 5, y + 23 - bh, 1, 1, "#ffe08a")}
            </g>
          ))
        : <>{R(x + 4, y + 5, Math.min(10, inner - 4), 3, "#ffffff", "px-cloud", 0.85)}</>}
      {R(x + w / 2 - 1, y + 2, 2, 17, city ? "#2a1a10" : "#f3efe6")}
    </g>
  );
}

function Rug({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      {R(x, y, w, h, "#7a3b3b")}
      {R(x + 2, y + 2, w - 4, h - 4, "#d8b56a")}
      {R(x + 3, y + 3, w - 6, h - 6, "#8f4a46")}
    </g>
  );
}
function Sofa({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {R(x + 2, y, 54, 13, "#2f3a4f")}
      {R(x + 4, y + 2, 24, 9, "#46546f")}
      {R(x + 30, y + 2, 24, 9, "#46546f")}
      {R(x, y + 11, 58, 11, "#27303f")}
      {R(x + 4, y + 12, 24, 5, "#3a465e")}
      {R(x + 30, y + 12, 24, 5, "#3a465e")}
      {R(x - 4, y + 6, 6, 16, "#222a38")}
      {R(x + 56, y + 6, 6, 16, "#222a38")}
    </g>
  );
}
/** 墙上的奖状 + 公司牌子。 */
function Plaque({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {R(x, y, 26, 18, "#d8b56a")}
      {R(x + 2, y + 2, 22, 14, "#fffdf4")}
      <text x={x + 13} y={y + 12} textAnchor="middle" fontSize={7} fill="#3a2416" className="px-font" fontWeight={700}>
        WWFS
      </text>
    </g>
  );
}
/** 销售部的彩旗。 */
function Bunting({ x, y, w }: { x: number; y: number; w: number }) {
  const cols = ["#f2c230", "#e0504a", "#4fd08a", "#ffffff"];
  return (
    <g>
      {R(x, y, w, 1, "#ffffff")}
      {[...Array(Math.floor(w / 12))].map((_, i) => <path key={i} d={`M${x + i * 12 + 2} ${y + 1}h8l-4 7z`} fill={cols[i % 4]} />)}
    </g>
  );
}
/** 财务部的保险柜。 */
function Safe({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {R(x, y, 28, 30, "#3e4a52")}
      {R(x, y, 28, 2, "#5f6e78")}
      {R(x + 3, y + 4, 22, 22, "#55636d")}
      <circle cx={x + 14} cy={y + 15} r={6} fill="#c9ccd8" stroke="#2a3238" strokeWidth={1} />
      {R(x + 13, y + 10, 2, 5, "#2a3238")}
      {R(x + 2, y + 30, 5, 2, "#2a3238")}
      {R(x + 21, y + 30, 5, 2, "#2a3238")}
    </g>
  );
}

const seatX = (w: number) => Math.max(22, Math.round((w - 20) / 2) + 6);

function Worker({ p, x, deskY, w, on, screen, away, onHover, onLeave }: { p: PixelPerson; x: number; deskY: number; w: number; on: boolean; screen?: string; away?: boolean; onHover: (p: PixelPerson) => void; onLeave: () => void }) {
  const router = useRouter();
  const px = x + seatX(w);
  const py = deskY - 24;
  return (
    <g className="px-person cursor-pointer" onClick={() => (p.external ? window.open(p.href, "_blank") : router.push(p.href))} onMouseEnter={() => onHover(p)} onMouseLeave={onLeave}>
      <rect x={x} y={py - 14} width={w} height={62} fill="transparent" />
      <Chair x={px - 2} y={py - 2} />
      {!away && <Person p={p} x={px} y={py} />}
      <Desk x={x} y={deskY} w={w} on={on} screen={screen} exec={p.key === "wallace"} job={p.key} />
      {on && <JobProps job={p.key} x={x} y={deskY} w={w} px={px} py={py} />}
      {!away && <Bubble p={p} x={px + 3} y={py + 2} />}
      {!away && (
        <g className="px-cursor">
          <path d={`M${px + 5} ${py - 8}h10l-5 6z`} fill="#ffdf3d" stroke="#2a1e1a" strokeWidth={1} />
        </g>
      )}
      <PixelLabel x={x + w / 2} y={deskY + 14} text={p.name} />
    </g>
  );
}

/** 市场部（摄影棚）：四张桌一排，每台电脑拉一根线到中间的 MAC，线上有数据在跑。 */
function StudioSeats({ room, x, y, w, h, onHover, onLeave }: { room: PixelRoom; x: number; y: number; w: number; h: number; onHover: (p: PixelPerson) => void; onLeave: () => void }) {
  const router = useRouter();
  const mac = room.people.find((p) => p.device);
  const staff = room.people.filter((p) => !p.device);
  const rank = (p: PixelPerson) => (SEAT_ORDER.indexOf(p.key) + 1 || 99);
  const people = [...staff].sort((a, b) => rank(a) - rank(b));
  const slot = Math.min(72, (w - 16) / Math.max(1, people.length));
  const left = x + (w - slot * people.length) / 2;
  const deskY = y + 74;
  const busY = y + h - 56;
  const macX = x + w / 2 - 17;
  const macY = y + h - 46;
  const cableX = (i: number) => Math.round(left + i * slot + 4 + 11);
  // Ivy 在岗就离开座位去巡检，卡住了才坐回桌前亮「!」
  const ivyOut = people.find((p) => p.key === "inspector" && (p.mood === "work" || p.mood === "happy"));
  const paths = people.map((_, i) => `M${cableX(i)} ${deskY + 1}V${busY}H${x + w / 2}V${macY + 1}`);
  return (
    <g>
      {paths.map((d) => <path key={"o" + d} d={d} stroke="#1e3a5f" strokeWidth={3} fill="none" />)}
      {paths.map((d) => <path key={d} d={d} stroke="#4fc3f7" strokeWidth={1} fill="none" />)}
      {people.map((p, i) => (
        <Worker key={p.key} p={p} x={left + i * slot + 4} deskY={deskY} w={slot - 8} on={p.mood === "work" || p.mood === "happy"} away={p === ivyOut} onHover={onHover} onLeave={onLeave} />
      ))}
      {/* 线画在桌前：从显示器底座下来，数据往 MAC 跑 */}
      {paths.map((d, i) => (
        <path key={"f" + d} d={d} stroke="#ffffff" strokeWidth={1} strokeDasharray="2 10" fill="none">
          <animate attributeName="stroke-dashoffset" from="12" to="0" dur="0.9s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
        </path>
      ))}
      {ivyOut && <IvyPatrol p={ivyOut} stops={people.map((_, i) => Math.round(left + i * slot + slot / 2 - 10))} y={deskY + 25} onHover={onHover} onLeave={onLeave} />}
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

function RoomDecor({ name, x, y, w, h }: { name: string; x: number; y: number; w: number; h: number }) {
  const b = y + h;
  switch (name) {
    case BIG_ROOM:
      return (
        <g>
          <OnAir x={x + w / 2 + 44} y={y + 8} />
          <Softbox x={x + 12} y={b - 42} />
          <Camera x={x + 46} y={b - 42} />
          <RingLight x={x + w - 82} y={b - 40} />
          <Softbox x={x + w - 36} y={b - 42} />
        </g>
      );
    case BOSS_ROOM:
      return (
        <g>
          <Plaque x={x + w - 58} y={y + 7} />
          <Shelf x={x + w - 34} y={y + 38} />
          <Plant x={x + w - 22} y={y + 72} />
          <Rug x={x + w / 2 - 54} y={b - 38} w={108} h={32} />
          <Sofa x={x + w / 2 - 29} y={b - 36} />
        </g>
      );
    case "销售部":
      return (
        <g>
          <Bunting x={x + 3} y={y + 25} w={w - 6} />
          <Plant x={x + 5} y={b - 24} />
          <ChartBoard x={x + w - 46} y={b - 42} />
        </g>
      );
    case "财务部":
      return (
        <g>
          <Safe x={x + 6} y={b - 36} />
          <Cabinet x={x + w - 36} y={b - 38} />
        </g>
      );
    case "茶水间":
      return <Pantry x={x + 10} y={y + 58} />;
    case "会议室":
      return (
        <g>
          <MeetingTable x={x + Math.round((w - 112) / 2)} y={y + 58} />
          <Plant x={x + 4} y={b - 24} />
        </g>
      );
    default:
      return <Plant x={x + 5} y={b - 24} />;
  }
}

function Room({ room, x, y, w, h, onHover, onLeave }: { room: PixelRoom; x: number; y: number; w: number; h: number; onHover: (p: PixelPerson) => void; onLeave: () => void }) {
  const router = useRouter();
  const look = ROOM_LOOK[room.name] || DEFAULT_LOOK;
  const studio = room.name === BIG_ROOM;
  const boss = room.name === BOSS_ROOM;
  const slots = room.people.filter((p) => !p.device);
  const widths = slots.map((p) => (p.key === "wallace" ? 80 : boss ? 58 : 60));
  const totalW = widths.reduce((n, v) => n + v, 0) + Math.max(0, slots.length - 1) * 10;
  const startX = boss ? x + Math.max(10, (w - 44 - totalW) / 2) : x + Math.max(8, (w - totalW) / 2);
  const deskY = y + 70;
  const plateW = [...room.name].length * 9 + 14;
  let cursor = startX;

  return (
    <g>
      <Floor look={look} x={x} y={y + WALL_H} w={w} h={h - WALL_H} />
      {R(x, y, w, WALL_H, look.wall)}
      <Wall look={look} x={x} y={y} w={w} />
      {R(x, y + WALL_H - 5, w, 5, look.trim)}
      {R(x, y + WALL_H - 5, w, 1, shade(look.trim, 0.25))}
      <Window x={x + 8} y={y + 4} w={boss ? Math.min(76, w / 2 - plateW / 2 - 14) : Math.min(30, w / 2 - plateW / 2 - 12)} city={boss} />
      {/* 钟 */}
      <circle cx={x + w - 16} cy={y + 14} r={9} fill="#fffdf4" stroke="#3a2a20" strokeWidth={2} />
      {[[0, -7], [7, 0], [0, 7], [-7, 0]].map(([dx, dy]) => <g key={`${dx}${dy}`}>{R(x + w - 16 + dx, y + 14 + dy, 1, 1, "#3a2a20")}</g>)}
      {R(x + w - 16, y + 9, 1, 6, "#3a2a20")}
      {R(x + w - 16, y + 14, 5, 1, "#c0392b", "px-hand")}
      {/* 房间名牌 */}
      {R(x + w / 2 - plateW / 2, y + 6, plateW, 16, "#3a2a20")}
      {R(x + w / 2 - plateW / 2 + 2, y + 8, plateW - 4, 12, "#fff8e7")}
      <text x={x + w / 2} y={y + 17.5} textAnchor="middle" fontSize={9} fill="#3a2a20" className="px-font" fontWeight={700}>
        {room.name}
      </text>
      {/* 边框墙 + 门 */}
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="#5e3b20" strokeWidth={3} />
      {R(x + w / 2 - 12, y + h - 3, 24, 4, look.floor[0])}

      <RoomDecor name={room.name} x={x} y={y} w={w} h={h} />

      {studio ? (
        <StudioSeats room={room} x={x} y={y} w={w} h={h} onHover={onHover} onLeave={onLeave} />
      ) : (
        slots.map((p, i) => {
          const sw = widths[i];
          const sx = cursor;
          cursor += sw + 10;
          if (p.seat)
            return (
              <g key={p.key} className="px-person cursor-pointer" onClick={() => router.push(p.href)} onMouseEnter={() => onHover(p)} onMouseLeave={onLeave}>
                <Chair x={sx + 34} y={deskY - 26} />
                <Desk x={sx} y={deskY} w={sw} on={false} />
                <Board x={sx + 22} y={deskY - 42} label="招聘中" />
                <PixelLabel x={sx + sw / 2} y={deskY + 14} text={p.name} />
              </g>
            );
          return <Worker key={p.key} p={p} x={sx} deskY={deskY} w={sw} on={p.mood === "work" || p.mood === "happy"} screen="#c7f0c0" onHover={onHover} onLeave={onLeave} />;
        })
      )}
      {/* Amelia 当助理：整理好的文件送到 Wallace 桌上 */}
      {boss && slots.length === 2 && <Flyer from={[startX + widths[0] + 10 + seatX(widths[1]), deskY - 14]} to={[startX + widths[0] - 16, deskY - 12]} dur={3}><Sheet /></Flyer>}
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
const ROOM_WEIGHT: Record<string, number> = { 会议室: 2, 茶水间: 1.4 };

/** 排房：人多的排第一排、分到的宽度多；一排里按人数分宽度，每间不小于 minW。 */
function layoutRooms(real: PixelRoom[], cols: number, W: number) {
  const size = (r: PixelRoom) => r.people.length;
  let rows: PixelRoom[][];
  const filler = (name: string): PixelRoom => ({ name, people: [] });
  if (cols >= 3) {
    rows = [real.filter((r) => size(r) >= 2), [...real.filter((r) => size(r) < 2), filler("会议室"), filler("茶水间")]];
  } else {
    const [first, ...rest] = [...real].sort((a, b) => size(b) - size(a));
    if (rest.length % 2) rest.push(filler("会议室"));
    rows = [[first]];
    for (let i = 0; i < rest.length; i += 2) rows.push(rest.slice(i, i + 2));
  }
  const inner = W - 16;
  return rows.filter((r) => r.length).map((row, ri) => {
    const avail = inner - (row.length - 1) * 8;
    const minW = ri === 0 && row.length > 1 ? 160 : 120;
    const weight = (r: PixelRoom) => ROOM_WEIGHT[r.name] ?? Math.max(1, size(r));
    const sum = row.reduce((n, r) => n + weight(r), 0);
    const extra = Math.max(0, avail - row.length * minW);
    let used = 0;
    const cells = row.map((room, i) => {
      const w = i === row.length - 1 ? avail - used : Math.round(minW + (extra * weight(room)) / sum);
      used += w;
      return { room, w };
    });
    return { cells, h: row.some((r) => size(r) >= 3) ? 168 : 136 };
  });
}

function Map({ rooms: real, cols, onHover, onLeave, onClaude }: { rooms: PixelRoom[]; cols: number; onHover: (p: PixelPerson) => void; onLeave: () => void; onClaude: () => void }) {
  const W = cols >= 3 ? 608 : 408;
  const rows = layoutRooms(real, cols, W);
  const H0 = rows.reduce((n, r) => n + r.h, 0) + (rows.length - 1) * HALL + 16;
  const mkt = real.find((r) => r.name === BIG_ROOM);
  const H = H0 + (mkt ? BELT_H : 0);
  const w = W - 16;
  let top = 8;
  const placed = rows.map((row) => {
    const y = top;
    top += row.h + HALL;
    return { ...row, y };
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" shapeRendering="crispEdges" role="img" aria-label="WWFS办公室像素地图">
      <rect width={W} height={H} fill="#7a5a3f" />
      {placed.slice(0, -1).map((row) => (
        <Hall key={row.y} x={8} y={row.y + row.h} w={w} />
      ))}
      {placed.map((row) => {
        let x = 8;
        return row.cells.map(({ room, w: rw }) => {
          const rx = x;
          x += rw + 8;
          return <Room key={room.name} room={room} x={rx} y={row.y} w={rw} h={row.h} onHover={onHover} onLeave={onLeave} />;
        });
      })}
      {placed.length > 1 && <ClaudePatrol x={14} y={placed[0].y + placed[0].h + 10} w={W - 28} onClick={onClaude} />}
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
