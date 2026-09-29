"use client";

import { useEffect, useRef } from "react";
import { BUILDINGS, CHECKPOINTS, ROAD_POINTS } from "@/game/mapData";
import { ARENA_BOXES } from "@/game/arena";
import type { MinimapState } from "@/game/store";

const SIZE = 148;
const RANGE = 95; // metres shown in each direction

export function Minimap({ map }: { map: MinimapState | null }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== SIZE * dpr) {
      canvas.width = SIZE * dpr;
      canvas.height = SIZE * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    // Paper background.
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillRect(0, 0, SIZE, SIZE);
    if (!map) return;
    const scale = SIZE / 2 / RANGE;
    const [px, , pz] = map.player;
    const X = (x: number) => SIZE / 2 + (x - px) * scale;
    const Y = (z: number) => SIZE / 2 + (z - pz) * scale;

    if (map.mode === "rescue") {
      // Rescue compound, safe zone, bike route and a hostage revealed only nearby.
      ctx.fillStyle = "rgba(42,157,72,0.12)";
      ctx.fillRect(X(-25), Y(51), 50 * scale, 31 * scale);
      ctx.fillStyle = "#c9c2b2";
      for (const b of BUILDINGS) {
        const w = b.size[0] * scale, h = b.size[2] * scale;
        ctx.fillRect(X(b.pos[0]) - w / 2, Y(b.pos[2]) - h / 2, w, h);
      }
      ctx.strokeStyle = "#b9b2a2";
      ctx.lineWidth = Math.max(2, 14 * scale);
      ctx.lineJoin = "round";
      ctx.beginPath();
      ROAD_POINTS.forEach(([x, , z], i) => i === 0 ? ctx.moveTo(X(x), Y(z)) : ctx.lineTo(X(x), Y(z)));
      ctx.stroke();
      CHECKPOINTS.forEach(([x, , z], i) => {
        ctx.beginPath();
        ctx.fillStyle = i < map.checkIndex ? "#2a9d48" : i === map.checkIndex ? "#e8a020" : "#9a9a9a";
        ctx.arc(X(x), Y(z), i === map.checkIndex ? 4 : 2.6, 0, Math.PI * 2);
        ctx.fill();
      });
      const hostageGap = Math.hypot(map.hostage[0] - px, map.hostage[2] - pz);
      if (map.rescued || hostageGap < 25) {
        ctx.fillStyle = map.rescued ? "#2a9d48" : "#e8590c";
        ctx.beginPath();
        ctx.arc(X(map.hostage[0]), Y(map.hostage[2]), 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.fillStyle = "#8a6d00";
      ctx.fillRect(X(map.bike[0]) - 3, Y(map.bike[2]) - 3, 6, 6);
    } else {
      // Ironworks: opaque cover and both team deployment zones only.
      ctx.fillStyle = "rgba(25,113,194,.12)";
      ctx.fillRect(X(-44), Y(16), 20 * scale, 22 * scale);
      ctx.fillStyle = "rgba(193,18,31,.12)";
      ctx.fillRect(X(24), Y(-38), 20 * scale, 22 * scale);
      for (const b of ARENA_BOXES) {
        if (b.kind === "ground") continue;
        ctx.fillStyle = b.kind === "building" ? "#657680" : b.kind === "container" ? "#8ba8b5" : b.kind === "wall" && b.size[1] > 3 ? "#49555b" : "#b0b4ae";
        const w = b.size[0] * scale, h = b.size[2] * scale;
        ctx.fillRect(X(b.pos[0]) - w / 2, Y(b.pos[2]) - h / 2, w, h);
      }
    }
    // Enemies.
    for (const e of map.enemies) {
      ctx.fillStyle = map.mode === "deathmatch" ? (map.team === "red" ? "#1971c2" : "#c1121f") : e.sniper ? "#7a0d14" : "#c1121f";
      ctx.beginPath();
      ctx.arc(X(e.x), Y(e.z), e.sniper ? 3.4 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Riders.
    for (const r of map.riders) {
      ctx.fillStyle = r.ace ? "#7a0d14" : "#e8590c";
      ctx.save();
      ctx.translate(X(r.x), Y(r.z));
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-2.4, -2.4, 4.8, 4.8);
      ctx.restore();
    }
    // Friendlies.
    for (const f of map.friendlies) {
      ctx.fillStyle = "#1971c2";
      ctx.beginPath();
      ctx.arc(X(f.x), Y(f.z), 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.rotate(Math.atan2(-Math.sin(map.yaw), -Math.cos(map.yaw)) + Math.PI);
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2.4);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North tick.
    ctx.fillStyle = "#555";
    ctx.font = "9px ui-monospace,monospace";
    ctx.fillText("N", 6, 12);
  }, [map]);

  return (
    <div className="minimap-wrap" aria-hidden="true">
      <canvas ref={ref} style={{ width: SIZE, height: SIZE }} />
    </div>
  );
}
