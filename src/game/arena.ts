/**
 * IRONWORKS: a compact, symmetrical 5v5 map separate from the rescue compound.
 * All cover, towers, spawn pads and bullet blockers come from this shared data.
 */
import { boxToAabb } from "./collision";
import type { AABB, BoxDef, LadderDef, TeamId, Vec3 } from "./types";
import type { PickupDef } from "./armament";

export const ARENA = { width: 100, depth: 84, centre: [0, 0, 0] as Vec3 };
export const ARENA_TEAM_SPAWNS: Record<TeamId, Vec3[]> = {
  // Both clusters sit 9m+ inside the outer wall and clear of every cover box.
  // They are exact 180° mirrors, so neither faction owns a safer first angle.
  blue: [[-38, 0.02, 24], [-33, 0.02, 28], [-39, 0.02, 16], [-30, 0.02, 21], [-42, 0.02, 30]],
  red: [[38, 0.02, -24], [33, 0.02, -28], [39, 0.02, -16], [30, 0.02, -21], [42, 0.02, -30]],
};
export const ARENA_YAW: Record<TeamId, number> = { blue: -Math.PI / 4, red: Math.PI * 3 / 4 };

const ground: BoxDef = { kind: "ground", pos: [0, -1, 0], size: [110, 2, 98] };
const boundary: BoxDef[] = [
  { kind: "wall", pos: [0, 1.75, -42], size: [101, 3.5, 1] },
  { kind: "wall", pos: [0, 1.75, 42], size: [101, 3.5, 1] },
  { kind: "wall", pos: [-50, 1.75, 0], size: [1, 3.5, 84] },
  { kind: "wall", pos: [50, 1.75, 0], size: [1, 3.5, 84] },
];
const centre: BoxDef[] = [
  // The central warehouse forces a choice: left flank, right flank, or roof.
  { kind: "building", pos: [0, 3.1, 0], size: [15, 6.2, 12] },
  { kind: "platform", pos: [0, 6.25, 0], size: [15.4, 0.3, 12.4] },
  { kind: "crate", pos: [0, 0.85, 18], size: [4, 1.7, 2.3] },
  { kind: "crate", pos: [0, 0.85, -18], size: [4, 1.7, 2.3] },
  { kind: "wall", pos: [0, 0.6, 30], size: [5, 1.2, 1] },
  { kind: "wall", pos: [0, 0.6, -30], size: [5, 1.2, 1] },
];

// Rotated copies guarantee equivalent cover for both squads.
const half: BoxDef[] = [
  { kind: "container", pos: [-20, 1.55, 9], size: [6.2, 3.1, 2.6] },
  { kind: "container", pos: [-14, 1.55, -12], size: [3, 3.1, 8] },
  { kind: "container", pos: [-34, 1.55, 0], size: [3, 3.1, 8] },
  { kind: "crate", pos: [-11, 1.1, 26], size: [3, 2.2, 3] },
  { kind: "crate", pos: [-17, 0.7, 24], size: [2.1, 1.4, 2.2] },
  { kind: "crate", pos: [-34, 1.1, -11], size: [3, 2.2, 3] },
  { kind: "wall", pos: [-10, 0.7, 14], size: [4, 1.4, 0.8] },
  { kind: "wall", pos: [-29, 0.75, 13], size: [3.2, 1.5, 0.9] },
  { kind: "wall", pos: [-24, 0.55, -21], size: [4, 1.1, 0.9] },
  { kind: "wall", pos: [-38, 0.55, -17], size: [3.2, 1.1, 0.8] },
];
const mirror: BoxDef[] = half.map(b => ({ kind: b.kind, pos: [-b.pos[0], b.pos[1], -b.pos[2]], size: [...b.size] }));

const platforms: BoxDef[] = [
  // Two three-metre-high sniper decks reachable by ladders.
  { kind: "platform", pos: [-26, 4.05, 0], size: [7, 0.3, 7] },
  { kind: "platform", pos: [26, 4.05, 0], size: [7, 0.3, 7] },
];
for (const x of [-26, 26]) {
  for (const dx of [-3, 3]) for (const dz of [-3, 3]) {
    platforms.push({ kind: "pillar", pos: [x + dx, 2, dz], size: [0.24, 4, 0.24] });
  }
  for (const z of [-3.5, 3.5]) {
    platforms.push({ kind: "railing", pos: [x, 4.8, z], size: [7, 0.13, 0.13] });
  }
  for (const dx of [-3.5, 3.5]) {
    platforms.push({ kind: "railing", pos: [x + dx, 4.8, 0], size: [0.13, 0.13, 7] });
  }
}

export const ARENA_LADDERS: LadderDef[] = [
  { id: "blue-deck", pos: [-26, 0, 4.65], yMin: 0, yMax: 4.2, radius: 0.82 },
  { id: "red-deck", pos: [26, 0, 4.65], yMin: 0, yMax: 4.2, radius: 0.82 },
  { id: "warehouse-roof", pos: [0, 0, 7.25], yMin: 0, yMax: 6.4, radius: 0.82 },
];

export const ARENA_BOXES: BoxDef[] = [ground, ...boundary, ...centre, ...half, ...mirror, ...platforms];
const solids = ARENA_BOXES.map(boxToAabb);
const blockers = ARENA_BOXES.filter(b => b.kind !== "ground").map(boxToAabb);
export const getArenaSolids = (): AABB[] => solids;
export const getArenaBlockers = (): AABB[] => blockers;
export const getArenaShotBlockers = (): AABB[] => solids;

export const ARENA_PICKUPS: PickupDef[] = [
  { id: "arena-west-ammo", kind: "ammo", pos: [-34, 1.1, -12], yaw: 0 },
  { id: "arena-east-ammo", kind: "ammo", pos: [34, 1.1, 12], yaw: 0 },
  { id: "arena-shotgun", kind: "shotgun", pos: [-3, 1.1, 21], yaw: 0.4 },
  { id: "arena-sniper", kind: "sniper", pos: [3, 1.1, -21], yaw: -0.4 },
  { id: "arena-deagle", kind: "deagle", pos: [0, 6.4, 0], yaw: 0 },
  { id: "arena-p90", kind: "p90", pos: [-14, 1.6, -12], yaw: 1.5 },
  { id: "arena-awp", kind: "awp", pos: [26, 4.2, 0], yaw: -1.5 },
];
