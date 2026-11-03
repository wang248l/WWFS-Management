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
  seat?: boolean; // 空位（招聘中）
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
const BODY = [".OCCCCCCCCO.", "OCCCDCCDCCCO", "OCCCCCCCCCCO"];
const HANDS_A = ["OSSCCCCCCSSO"];
const HANDS_B = ["OCCSSCCSSCCO"];

type Look = { hair: string; skin: string; shirt: string; dark: string; face: string[]; glasses?: boolean };
const LOOKS: Record<string, Look> = {
  mark: { hair: "#2b2b3a", skin: "#f6c9a4", shirt: "#3b6fe0", dark: "#2a4fa8", face: FACE_SHORT, glasses: true },
  mac: { hair: "#6b3f1f", skin: "#f3c19b", shirt: "#8f4fd8", dark: "#6633a8", face: FACE_SPIKY },
  leo: { hair: "#d98b2b", skin: "#f6cfa8", shirt: "#f08a24", dark: "#b8611a", face: FACE_SPIKY },
  recruit: { hair: "#1f1f2a", skin: "#f4c7a2", shirt: "#16a394", dark: "#0f766e", face: FACE_BUN },
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
  const pal: Record<string, string> = { O: "#2a1e1a", H: L.hair, S: L.skin, E: "#1a1420", B: "#f29a9a", M: "#b5525a", C: L.shirt, D: L.dark };
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
      <Pixels rows={BODY} pal={pal} x={x} y={y + 10 * P} />
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
function Desk({ x, y, w, on, imac }: { x: number; y: number; w: number; on: boolean; imac?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={14} fill="#8a5a33" />
      <rect x={x} y={y} width={w} height={3} fill="#b07a48" />
      <rect x={x} y={y + 14} width={w} height={2} fill="#5e3b20" />
      <rect x={x + 2} y={y + 16} width={3} height={6} fill="#5e3b20" />
      <rect x={x + w - 5} y={y + 16} width={3} height={6} fill="#5e3b20" />
      {imac ? (
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

const ROOM_FLOOR: Record<string, [string, string]> = {
  社媒运营部: ["#d7e8f7", "#c9def2"],
  市场部: ["#f7ebcf", "#f1e0b8"],
  增员部: ["#d4f0ea", "#c3e8e0"],
  内容部: ["#e6dcf5", "#dacdf0"],
  出镜顾问: ["#f8dce8", "#f2cddd"],
  销售部: ["#e4dff7", "#d8d1f2"],
};

const TILE = 16;
const ROOM_W = 12 * TILE; // 192
const ROOM_H = 9 * TILE; // 144
const HALL = 2 * TILE;

function Room({ room, x, y, onHover, onLeave }: { room: PixelRoom; x: number; y: number; onHover: (p: PixelPerson) => void; onLeave: () => void }) {
  const router = useRouter();
  const [f1, f2] = ROOM_FLOOR[room.name] || ["#ece6dc", "#e2dacd"];
  const tiles: JSX.Element[] = [];
  for (let ty = 2; ty < 9; ty++)
    for (let tx = 0; tx < 12; tx++)
      tiles.push(<rect key={`${tx}-${ty}`} x={x + tx * TILE} y={y + ty * TILE} width={TILE} height={TILE} fill={(tx + ty) % 2 ? f1 : f2} />);

  // 座位：共用的两个人一张长桌一台 iMac，其他人各一张桌
  const shared = room.people.filter((p) => p.shared);
  const solo = room.people.filter((p) => !p.shared);
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
      <rect x={x} y={y} width={ROOM_W} height={2 * TILE} fill="#a77c5a" />
      <rect x={x} y={y + 2 * TILE - 4} width={ROOM_W} height={4} fill="#7b573b" />
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
      <Plant x={x + 6} y={y + ROOM_H - 26} />
      {room.name === "出镜顾问" ? <Camera x={x + ROOM_W - 52} y={y + ROOM_H - 30} /> : <Shelf x={x + ROOM_W - 34} y={y + ROOM_H - 28} />}

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
            <Desk x={sx} y={deskY} w={s.w} on={on} imac={n > 1} />
            {n > 1 && (
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

function Map({ rooms, cols, onHover, onLeave }: { rooms: PixelRoom[]; cols: number; onHover: (p: PixelPerson) => void; onLeave: () => void }) {
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
        return <Room key={room.name} room={room} x={8 + c * (ROOM_W + 8)} y={8 + r * (ROOM_H + HALL)} onHover={onHover} onLeave={onLeave} />;
      })}
    </svg>
  );
}

const WELCOME = "欢迎来到 WWFS办公室！鼠标放在同事身上看他在干什么，点一下进他的工位。";

export default function PixelOffice({ rooms }: { rooms: PixelRoom[] }) {
  const [who, setWho] = useState<PixelPerson | null>(null);
  const full = useMemo(() => {
    if (!who) return WELCOME;
    if (who.seat) return `${who.name}：${who.title}。这个位子还空着，宣发移交的客户先放在看板「移交销售」。`;
    const t = who.task ? `正在：${who.task}` : "手上没事。";
    return `${who.name}（${who.title}${who.tags ? " · " + who.tags.replace(/,/g, "/") : ""}）· ${who.statusLabel}\n${t}${who.unread ? `\n你有 ${who.unread} 条留言他还没看。` : ""}`;
  }, [who]);
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
    <div className="px-office rounded-2xl overflow-hidden border-4 border-[#3a2a20] shadow-xl bg-[#7a5a3f]">
      <div className="hidden md:block">
        <Map rooms={rooms} cols={3} onHover={setWho} onLeave={leave} />
      </div>
      <div className="md:hidden">
        <Map rooms={rooms} cols={2} onHover={setWho} onLeave={leave} />
      </div>
      {/* GBA 式对话框 */}
      <div className="bg-[#3a2a20] p-2">
        <div className="px-dialog relative rounded-md bg-[#fffdf4] border-4 border-double border-[#4a6fd8] px-4 py-3 min-h-[4.5rem] text-[15px] leading-relaxed text-[#2a1e1a] whitespace-pre-wrap">
          {shown}
          <span className="px-caret absolute right-3 bottom-2 text-[#4a6fd8]">▼</span>
        </div>
      </div>
    </div>
  );
}
