/** Shared deterministic collision / layout data. X east, -Z north, Y up.
 *  The compound spans 260m x 185m; the escape road runs another 400m south. */
import { boxToAabb } from "./collision";
import type { AABB, BikeDef, BoxDef, EnemySpawnDef, HostageDef, LadderDef, TowerDef, Vec3 } from "./types";

export const WORLD = { half: 130, outer: 145, north: -150, south: 470, groundSize: 1200 };
export const TOWER = { platformHeight: 10, legSize: 0.25, legInset: 2, platformThickness: 0.24, railingHeight: 1.05, platformSpan: 4.7 };
export const PLAYER_SPAWN: Vec3 = [0, 0.02, 59];
export const PLAYER_SPAWN_YAW = 0;

/**
 * Ten valid tactical spawns, five per faction. The blue squad holds the
 * southern staging area; red squad controls the north freight approach.
 */
export const TEAM_SPAWNS = {
  blue: [
    [0, 0.02, 59], [-7, 0.02, 60], [7, 0.02, 60], [-12, 0.02, 66], [12, 0.02, 66],
  ] as Vec3[],
  red: [
    [0, 0.02, -140], [-9, 0.02, -140], [9, 0.02, -140], [-18, 0.02, -136], [18, 0.02, -136],
  ] as Vec3[],
};
export const TEAM_YAW = { blue: 0, red: Math.PI } as const;
export const TEAM_COLORS = { blue: 0x1971c2, red: 0xc1121f } as const;
export const TEAM_SCORE_LIMIT = 30;
export const TEAM_CAPACITY = 5;
export const TEAM_RESPAWN_SECONDS = 3;
/**
 * The hostage is not out in the open pen — she is locked inside a buried
 * concrete shelter behind a blast-door corridor. Nothing is visible from the
 * outside except an earth berm and one steel door.
 */
export const BUNKER = {
  centre: [-58, 0, -30] as Vec3,
  /** Walkable mouth of the blast-door corridor. */
  door: [-58, 0, -21] as Vec3,
  interior: [-58, 0, -30.2] as Vec3,
};
export const HOSTAGE: HostageDef = { pos: [-58, 0, -31.6], yaw: Math.PI };

/** Concrete shell: thick enough to stop gunfire, one doorway to the south. */
export const BUNKER_CONCRETE: BoxDef[] = [
  // Main room: 11 x 9 footprint, 3.2m walls, one 3m door gap in the south face.
  { kind: "building", pos: [-58, 1.6, -34], size: [11, 3.2, 1] },
  { kind: "building", pos: [-63, 1.6, -30], size: [1, 3.2, 7] },
  { kind: "building", pos: [-53, 1.6, -30], size: [1, 3.2, 7] },
  { kind: "building", pos: [-61.5, 1.6, -26], size: [4, 3.2, 1] },
  { kind: "building", pos: [-54.5, 1.6, -26], size: [4, 3.2, 1] },
  { kind: "building", pos: [-58, 3.4, -30], size: [11.4, 0.4, 9.4] },
  // Corridor walls funnel anyone entering into a 3m-wide killbox.
  { kind: "building", pos: [-59.7, 1.5, -23.5], size: [0.5, 3, 5.2] },
  { kind: "building", pos: [-56.3, 1.5, -23.5], size: [0.5, 3, 5.2] },
  { kind: "building", pos: [-58, 3.15, -23.5], size: [4, 0.3, 5.2] },
  // Interior blast baffle: you must walk in and turn the corner to find her,
  // so there is no sight line at all from outside or from the doorway.
  { kind: "building", pos: [-59.25, 1.6, -29], size: [6.5, 3.2, 0.6] },
];

/** Earth heaped over and around the shelter so it reads as buried. */
export const BUNKER_EARTH: BoxDef[] = [
  { kind: "berm", pos: [-58, 3.95, -30], size: [15, 0.9, 12.5] },
  { kind: "berm", pos: [-58, 4.6, -30.5], size: [10.5, 0.7, 8.5] },
  { kind: "berm", pos: [-58, 5.05, -31], size: [6.5, 0.5, 5.5] },
  { kind: "berm", pos: [-65.5, 1.5, -30], size: [4, 3, 12.5] },
  { kind: "berm", pos: [-50.5, 1.5, -30], size: [4, 3, 12.5] },
  { kind: "berm", pos: [-58, 1.5, -36.5], size: [15, 3, 4] },
  { kind: "berm", pos: [-63.5, 1.2, -23], size: [7, 2.4, 5.5] },
  { kind: "berm", pos: [-52.5, 1.2, -23], size: [7, 2.4, 5.5] },
];
export const BIKE: BikeDef = { pos: [0, 0.02, 55.6], yaw: Math.PI };
export const INTERACT_RANGE_HOSTAGE = 2.8;
export const INTERACT_RANGE_BIKE = 3;
export const SPAWN_PROTECTION_SECONDS = 8;
export function isSafeZone(pos: Vec3): boolean {
  return pos[2] >= 51 && pos[2] <= 82 && Math.abs(pos[0]) < 25;
}

export type BuildingDef = BoxDef & { windows: boolean; label: string };
export const BUILDINGS: BuildingDef[] = [
  // Original south complex.
  { kind: "building", pos: [-12, 3.3, 46], size: [15, 6.6, 26], windows: true, label: "01 / SECURITY" },
  { kind: "building", pos: [-26, 3.8, -3], size: [26, 7.6, 21], windows: true, label: "02 / WAREHOUSE" },
  { kind: "building", pos: [22, 2.6, 16], size: [16, 5.2, 9], windows: false, label: "03 / MAINTENANCE" },
  { kind: "building", pos: [-33, 2.7, -41], size: [22, 5.4, 11], windows: true, label: "04 / BARRACKS" },
  { kind: "building", pos: [23, 2.2, -53], size: [16, 4.4, 10], windows: true, label: "05 / OPERATIONS" },
  // North freight district.
  { kind: "building", pos: [-52, 5, -104], size: [76, 10, 30], windows: true, label: "06 / FREIGHT DEPOT" },
  { kind: "building", pos: [48, 3.5, -110], size: [34, 7, 24], windows: false, label: "07 / LOADING BAY" },
  { kind: "building", pos: [-4, 4.2, -122], size: [30, 8.4, 16], windows: true, label: "08 / COLD STORE" },
  // West fuel farm and stores.
  { kind: "building", pos: [-94, 2.5, 22], size: [14, 5, 18], windows: true, label: "09 / PUMP HOUSE" },
  { kind: "building", pos: [-96, 4, -72], size: [26, 8, 18], windows: true, label: "10 / STORES" },
  // East works.
  { kind: "building", pos: [96, 3.5, 30], size: [30, 7, 20], windows: true, label: "11 / WORKSHOP" },
  { kind: "building", pos: [104, 2.8, -78], size: [22, 5.6, 14], windows: true, label: "12 / CONTROL" },
];

export const TANKS = [
  { pos: [45, 0, 3] as Vec3, radius: 9, height: 14 },
  { pos: [49, 0, -25] as Vec3, radius: 7, height: 11 },
  { pos: [29, 0, -31] as Vec3, radius: 6, height: 8.5 },
  { pos: [-112, 0, -8] as Vec3, radius: 10, height: 15 },
  { pos: [-118, 0, 20] as Vec3, radius: 7.5, height: 11.5 },
];

export const TOWERS: TowerDef[] = [
  { id: "tower-central", pos: [-1, 10, -19], platformHeight: 10 },
  { id: "tower-nw", pos: [-54, 10, -54], platformHeight: 10 },
  { id: "tower-ne", pos: [55, 10, -54], platformHeight: 10 },
  { id: "tower-west", pos: [-51, 10, 15], platformHeight: 10 },
  { id: "tower-far-nw", pos: [-114, 10, -124], platformHeight: 10 },
  { id: "tower-far-ne", pos: [114, 10, -124], platformHeight: 10 },
  { id: "tower-far-w", pos: [-114, 10, 4], platformHeight: 10 },
  { id: "tower-far-e", pos: [114, 10, -20], platformHeight: 10 },
];

export type FencePanelDef = { pos: Vec3; yaw: number; width: number; height: number };
const fence = (x: number, z: number, width: number, yaw = 0, height = 3.15): FencePanelDef => ({ pos: [x, height / 2, z], yaw, width, height });
export const FENCE_PANELS: FencePanelDef[] = [
  fence(-66.25, 54.5, 127.5), fence(66.25, 54.5, 127.5), // 5m gate straight ahead at the staging area
  fence(0, -132, 260), fence(-130, -38.75, 186.5, Math.PI / 2), fence(130, -38.75, 186.5, Math.PI / 2),
  fence(35, 24, 32), fence(19, 8, 32, Math.PI / 2), // tank enclosure, open to the north
];
export const PEN_CENTER_POS: Vec3 = HOSTAGE.pos;
export const PEN_PANELS: FencePanelDef[] = [
  fence(8, -38, 9, 0, 2.6), fence(3.5, -34, 8, Math.PI / 2, 2.6),
  fence(12.5, -34, 8, Math.PI / 2, 2.6), fence(4.75, -30, 2.5, 0, 2.6), fence(11.25, -30, 2.5, 0, 2.6),
];
const fenceBoxes = (panels: FencePanelDef[]): BoxDef[] => panels.map(p => ({
  kind: "fence", pos: p.pos, size: p.yaw === 0 ? [p.width, p.height, 0.14] : [0.14, p.height, p.width],
}));
export const CRATES: BoxDef[] = [
  // Staging supplies.
  { kind: "crate", pos: [2.2, 0.46, 57.5], size: [1.9, 0.92, 1.1] },
  { kind: "crate", pos: [-2.2, 0.45, 57], size: [1.5, 0.9, 1] },
  // South yard.
  { kind: "container", pos: [13, 1.6, 32], size: [5.8, 3.2, 2.6] },
  { kind: "container", pos: [24, 1.6, 30], size: [5.8, 3.2, 2.6] },
  { kind: "crate", pos: [10, 0.7, 28], size: [1.6, 1.4, 1.6] },
  { kind: "crate", pos: [13, 1.25, 27], size: [2.5, 2.5, 2.5] },
  { kind: "crate", pos: [-5.5, 0.45, 18], size: [2.4, 0.9, 1.5] },
  { kind: "crate", pos: [-8, 1, 11], size: [2.8, 2, 2.4] },
  { kind: "container", pos: [-9, 1.6, -10], size: [2.6, 3.2, 5.8] },
  { kind: "crate", pos: [17, 0.7, -11], size: [2.5, 1.4, 2] },
  { kind: "crate", pos: [9, 0.45, -21], size: [1.7, 0.9, 1.1] },
  { kind: "crate", pos: [-1, 10.35, -19], size: [1.5, 0.7, 0.8] },
  { kind: "container", pos: [-43, 1.6, 28], size: [6, 3.2, 2.6] },
  // Freight district stacks.
  { kind: "container", pos: [-38, 1.6, -84], size: [6, 3.2, 2.6] },
  { kind: "container", pos: [-31, 1.6, -84], size: [6, 3.2, 2.6] },
  { kind: "container", pos: [-34.5, 4.8, -84], size: [6, 3.2, 2.6] },
  { kind: "container", pos: [30, 1.6, -95], size: [2.6, 3.2, 6] },
  { kind: "container", pos: [78, 1.6, -52], size: [6, 3.2, 2.6] },
  { kind: "container", pos: [85, 1.6, -52], size: [6, 3.2, 2.6] },
  { kind: "crate", pos: [72, 0.9, -20], size: [2.4, 1.8, 2.4] },
  { kind: "crate", pos: [76, 0.7, -17], size: [1.6, 1.4, 1.6] },
  { kind: "container", pos: [-74, 1.6, -20], size: [2.6, 3.2, 6] },
  { kind: "crate", pos: [-70, 0.7, 42], size: [2.5, 1.4, 2] },
  { kind: "crate", pos: [55, 0.7, -88], size: [2.5, 1.4, 2] },
  // Container maze (east yard): tight CQB lanes with stacked lookouts.
  { kind: "container", pos: [60, 1.6, 16], size: [6, 3.2, 2.6] },
  { kind: "container", pos: [69, 1.6, 16], size: [6, 3.2, 2.6] },
  { kind: "container", pos: [60, 4.8, 16], size: [6, 3.2, 2.6] },
  { kind: "container", pos: [57, 1.6, 24], size: [6, 3.2, 2.6] },
  { kind: "container", pos: [66, 1.6, 24], size: [6, 3.2, 2.6] },
  { kind: "container", pos: [66, 4.8, 24], size: [6, 3.2, 2.6] },
  { kind: "container", pos: [75, 1.6, 21], size: [2.6, 3.2, 6] },
  { kind: "container", pos: [57, 1.6, 33], size: [6, 3.2, 2.6] },
  { kind: "container", pos: [65, 1.6, 33], size: [6, 3.2, 2.6] },
  { kind: "container", pos: [72, 1.6, 37], size: [2.6, 3.2, 6] },
  { kind: "container", pos: [54.5, 1.6, 40], size: [2.6, 3.2, 6] },
  { kind: "container", pos: [63, 1.6, 43], size: [6, 3.2, 2.6] },
  { kind: "container", pos: [70, 1.6, 45], size: [6, 3.2, 2.6] },
  { kind: "container", pos: [69, 4.8, 45], size: [6, 3.2, 2.6] },
  { kind: "crate", pos: [64, 0.7, 29], size: [2.2, 1.4, 2.2] },
  { kind: "crate", pos: [74, 0.7, 31], size: [2.2, 1.4, 2.2] },
  // Extra cover at varied heights through the compound lanes.
  { kind: "wall", pos: [58, 0.45, 19], size: [3.4, 0.9, 0.8] },
  { kind: "wall", pos: [67, 0.57, 35], size: [3.4, 1.15, 0.9] },
  { kind: "wall", pos: [63, 0.8, 47], size: [3.6, 1.6, 1] },
  { kind: "wall", pos: [71, 0.45, -26], size: [4, 0.9, 0.9] },
  { kind: "wall", pos: [84, 0.45, -46], size: [3.4, 0.9, 0.8] },
  { kind: "wall", pos: [8, 0.57, 29], size: [1, 1.15, 3] },
  { kind: "wall", pos: [-15.5, 0.45, 26], size: [3, 0.9, 0.8] },
  { kind: "wall", pos: [40, 0.8, -10], size: [3.2, 1.6, 0.9] },
  { kind: "wall", pos: [-30, 0.57, -24], size: [1.2, 1.15, 3.4] },
  { kind: "wall", pos: [10, 0.8, -12], size: [3.2, 1.6, 0.9] },
];
export const COVER: BoxDef[] = [
  { kind: "wall", pos: [-7, 0.65, 62], size: [4, 1.3, 0.65] },
  { kind: "wall", pos: [13, 0.65, 60], size: [4.4, 1.3, 0.65] },
  { kind: "wall", pos: [-3, 0.65, 35], size: [3.3, 1.3, 0.65] },
  { kind: "wall", pos: [7, 0.65, 7], size: [4.4, 1.3, 0.65] },
  { kind: "wall", pos: [-40, 0.65, -70], size: [4.4, 1.3, 0.65] },
  { kind: "wall", pos: [64, 0.65, -34], size: [4.4, 1.3, 0.65] },
];

/**
 * Escape road starts under the parked bike and runs due south, then eases
 * through wide S-bends. Checkpoints sit on the centreline so the painted
 * ribbon, rails and gates share the same geometry.
 */
export const ROAD_POINTS: Vec3[] = [
  [BIKE.pos[0], 0, BIKE.pos[2]],
  [0, 0, 72],
  [0, 0, 88],
  [0, 0, 104],
  [0, 0, 120],
  [8, 0, 142],
  [16, 0, 165],
  [16, 0, 188],
  [16, 0, 210],
  [4, 0, 236],
  [-10, 0, 260],
  [-10, 0, 285],
  [-10, 0, 310],
  [0, 0, 338],
  [8, 0, 365],
  [4, 0, 392],
  [0, 0, 420],
  [0, 0, 438],
  [0, 0, 452],
];
export const CHECKPOINTS: Vec3[] = [
  [0, 0, 88],
  [0, 0, 120],
  [16, 0, 165],
  [16, 0, 210],
  [-10, 0, 260],
  [-10, 0, 310],
  [8, 0, 365],
  [0, 0, 452],
];
export const ROAD_HALF_WIDTH = 7;
export const ROAD_OBSTACLES: BoxDef[] = [
  { kind: "crate", pos: [4.2, 0.75, 104], size: [1.6, 1.5, 1.6] },
  { kind: "crate", pos: [20.4, 0.75, 188], size: [1.8, 1.5, 1.8] },
  { kind: "crate", pos: [-5.8, 0.65, 236], size: [1.6, 1.3, 1.6] },
  { kind: "crate", pos: [-14.2, 0.7, 285], size: [1.8, 1.4, 1.8] },
  { kind: "crate", pos: [4.6, 0.7, 392], size: [1.8, 1.4, 1.8] },
];
export const ROAD_RAILS: BoxDef[] = [];
for (let i = 1; i < ROAD_POINTS.length; i++) {
  const a = ROAD_POINTS[i - 1], b = ROAD_POINTS[i];
  const distance = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const nx = -(b[2] - a[2]) / distance, nz = (b[0] - a[0]) / distance;
  for (let t = 0; t < distance; t += 5) {
    for (const sign of [-1, 1]) {
      ROAD_RAILS.push({ kind: "pillar", pos: [a[0] + (b[0] - a[0]) * t / distance + nx * 8.8 * sign, 0.65, a[2] + (b[2] - a[2]) * t / distance + nz * 8.8 * sign], size: [0.25, 1.3, 0.25] });
    }
  }
}

function towerBoxes(t: TowerDef): BoxDef[] {
  const x = t.pos[0], z = t.pos[2], h = t.platformHeight;
  const out: BoxDef[] = [];
  for (const dx of [-2, 2]) for (const dz of [-2, 2]) out.push({ kind: "towerLeg", pos: [x + dx, h / 2, z + dz], size: [0.25, h, 0.25] });
  out.push({ kind: "platform", pos: [x, h - 0.12, z], size: [4.7, 0.24, 4.7] });
  out.push({ kind: "platform", pos: [x, h + 2.75, z], size: [5.5, 0.15, 5.5] });
  for (const side of [-1, 1]) {
    out.push({ kind: "railing", pos: [x + side * 2.3, h + 1, z], size: [0.09, 0.09, 4.6] });
    out.push({ kind: "railing", pos: [x, h + 1, z - 2.3], size: [4.6, 0.09, 0.09] });
    out.push({ kind: "railing", pos: [x + side * 1.65, h + 1, z + 2.3], size: [1.25, 0.09, 0.09] });
  }
  return out;
}
export const TOWER_BOXES = TOWERS.flatMap(towerBoxes);
/** Extra ladders the world draws itself: warehouse roof + elevated catwalk. */
export const EXTRA_LADDERS: LadderDef[] = [
  { id: "warehouse-roof-ladder", pos: [-26, 0, 7.85], yMin: 0, yMax: 7.6, radius: 0.75 },
  { id: "catwalk-ladder", pos: [16, 0, 27.85], yMin: 0, yMax: 5.2, radius: 0.75 },
];
export const LADDERS: LadderDef[] = [
  ...TOWERS.map<LadderDef>(t => ({ id: `${t.id}-ladder`, pos: [t.pos[0], 0, t.pos[2] + 2.95], yMin: 0, yMax: t.platformHeight, radius: 0.75 })),
  ...EXTRA_LADDERS,
];

const ground: BoxDef = { kind: "ground", pos: [0, -1, 160], size: [WORLD.groundSize, 2, WORLD.groundSize] };
// Map-edge barriers stop the player walking out, but are chain-link: bullets
// and sight pass straight through, so nothing invisible eats a shot.
const boundaries: BoxDef[] = [
  { kind: "boundary", pos: [0, 3, WORLD.north], size: [290, 6, 1] },
  { kind: "boundary", pos: [0, 3, WORLD.south], size: [290, 6, 1] },
  { kind: "boundary", pos: [-WORLD.outer, 3, 160], size: [1, 6, 620] },
  { kind: "boundary", pos: [WORLD.outer, 3, 160], size: [1, 6, 620] },
];
/** Explosive drums scattered where fights actually happen. */
export type BarrelDef = { id: string; pos: Vec3; radius: number; height: number };
export const BARRELS: BarrelDef[] = [
  { id: "bar-maze-a", pos: [63, 0, 21], radius: 0.36, height: 1.05 },
  { id: "bar-maze-b", pos: [67.5, 0, 38], radius: 0.36, height: 1.05 },
  { id: "bar-maze-c", pos: [61.5, 0, 30], radius: 0.36, height: 1.05 },
  { id: "bar-rail-a", pos: [61.5, 0, -46], radius: 0.36, height: 1.05 },
  { id: "bar-rail-b", pos: [70, 0, -28], radius: 0.36, height: 1.05 },
  { id: "bar-yard", pos: [-11.5, 0, 27.5], radius: 0.36, height: 1.05 },
];
const barrelBoxes: BoxDef[] = BARRELS.map(b => ({
  kind: "crate", pos: [b.pos[0], b.height / 2, b.pos[2]] as Vec3,
  size: [b.radius * 2.08, b.height, b.radius * 2.08] as Vec3,
}));

/** Elevated catwalk: decks, railings, grating and support legs at y≈5.2. */
function catwalkBoxes(): BoxDef[] {
  const out: BoxDef[] = [
    { kind: "platform", pos: [6, 5.075, 26], size: [20, 0.25, 3] },
    { kind: "platform", pos: [16, 5.075, 22.5], size: [4, 0.25, 4] },
    // South rail stops at the ladder gap; north rail stops at the roof link.
    { kind: "railing", pos: [5.25, 5.9, 27.4], size: [18.5, 0.08, 0.08] },
    { kind: "railing", pos: [5, 5.9, 24.6], size: [18, 0.08, 0.08] },
    { kind: "railing", pos: [-4, 5.9, 26], size: [0.08, 0.08, 3] },
    { kind: "railing", pos: [14.2, 5.9, 22.5], size: [0.08, 0.08, 4] },
    { kind: "railing", pos: [18, 5.9, 22.5], size: [0.08, 0.08, 4] },
  ];
  for (const x of [-4, 0, 4, 8, 12]) {
    out.push({ kind: "pillar", pos: [x, 5.6, 24.6], size: [0.1, 0.8, 0.1] });
    out.push({ kind: "pillar", pos: [x, 5.6, 27.4], size: [0.1, 0.8, 0.1] });
  }
  for (const [x, z] of [[-4, 24.8], [-4, 27.2], [4, 24.8], [4, 27.2], [12, 24.8], [12, 27.2], [14.6, 20.8], [17.6, 20.8]] as [number, number][]) {
    out.push({ kind: "pillar", pos: [x, 2.475, z], size: [0.16, 4.95, 0.16] });
  }
  return out;
}
export const CATWALK_BOXES = catwalkBoxes();

/** Rail yard collision: the wagon deck (jumpable) and the tall tank van. */
export const RAIL_BOXES: BoxDef[] = [
  { kind: "crate", pos: [66, 0.8, -34], size: [2.6, 0.5, 8] },
  { kind: "crate", pos: [66, 0.35, -34], size: [1.6, 0.35, 7] },
  { kind: "container", pos: [76, 1.9, -30], size: [3.4, 3.4, 6.4] },
  { kind: "container", pos: [66, 1.4, -44], size: [3, 2.8, 5] },
];

/** Vehicle wrecks used as hard cover. */
export const WRECK_BOXES: BoxDef[] = [
  { kind: "crate", pos: [-14, 0.7, 30], size: [4.4, 1.4, 1.9] },
  { kind: "container", pos: [40, 1.1, 44], size: [2.4, 2.2, 6.4] },
];

export const MAP_BOXES: BoxDef[] = [ground, ...boundaries, ...BUILDINGS, ...CRATES, ...COVER, ...TOWER_BOXES, ...fenceBoxes(FENCE_PANELS), ...fenceBoxes(PEN_PANELS), ...ROAD_RAILS, ...ROAD_OBSTACLES,
  ...BUNKER_CONCRETE, ...BUNKER_EARTH,
  ...CATWALK_BOXES, ...RAIL_BOXES, ...WRECK_BOXES, ...barrelBoxes,
  // Tank collision matches the drawn cylinder exactly (full width 2r + a hair):
  // never a phantom wall outside the shell, never a bullet slipping through it.
  ...TANKS.map(t => ({ kind: "building" as const, pos: [t.pos[0], t.height / 2, t.pos[2]] as Vec3, size: [t.radius * 2 + 0.1, t.height, t.radius * 2 + 0.1] as Vec3 })),
];
const solids = MAP_BOXES.map(boxToAabb);
// Only thick, visible geometry stops a bullet: chain-link and the map-edge
// barrier let fire and sight through, so there are no invisible walls.
const blockers = MAP_BOXES.filter(b => b.kind !== "ground" && b.kind !== "fence" && b.kind !== "boundary").map(boxToAabb);

/** Everything a bullet can actually strike: opaque cover plus the ground.
 *  Chain-link and the map-edge barrier are see-through, so a round flies on —
 *  exactly what the player can see through is what shots fly through. */
let cachedShotBlockers: AABB[] | null = null;
export function getShotBlockers(): AABB[] {
  if (!cachedShotBlockers) {
    cachedShotBlockers = MAP_BOXES.filter(b => b.kind !== "fence" && b.kind !== "boundary").map(boxToAabb);
  }
  return cachedShotBlockers;
}
export function getSolidAabbs(): AABB[] { return solids; }
export function getBlockerAabbs(): AABB[] { return blockers; }

const spawn = (id: string, x: number, z: number, points: [number, number][]): EnemySpawnDef => ({ id, kind: "guard", pos: [x, 0.02, z], yaw: Math.PI, patrol: points.map(([px, pz]) => [px, 0.02, pz]) });
export const ENEMY_SPAWNS: EnemySpawnDef[] = [
  spawn("guard-1", -3, 18, [[-3, 18], [3, 18], [3, 7], [-3, 7]]),
  spawn("guard-2", -42, -17, [[-42, -17], [-16, -17], [-16, -29], [-42, -29]]),
  spawn("guard-3", 11, -4, [[11, -4], [13, -14], [19, -14], [19, -4]]),
  spawn("guard-4", 4, -27, [[4, -27], [13, -27], [15, -24], [4, -24]]),
  spawn("guard-5", -31, 20, [[-31, 20], [-22, 20], [-22, 11], [-31, 11]]),
  spawn("guard-6", -52, -88, [[-52, -88], [-88, -88], [-88, -96], [-52, -96]]),
  spawn("guard-7", 48, -94, [[48, -94], [66, -94], [66, -84], [48, -84]]),
  spawn("guard-8", -84, -8, [[-84, -8], [-84, 26], [-100, 26], [-100, -8]]),
  spawn("guard-9", -104, 34, [[-104, 34], [-78, 34], [-78, 42], [-104, 42]]),
  spawn("guard-10", 96, 46, [[96, 46], [78, 46], [78, 38], [96, 38]]),
  spawn("guard-11", -96, -84, [[-96, -84], [-80, -84], [-80, -64], [-96, -64]]),
  spawn("guard-12", 0, -112, [[-24, -112], [24, -112], [24, -104], [-24, -104]]),
  spawn("guard-13", 104, -60, [[104, -60], [82, -60], [82, -70], [104, -70]]),
  // Patrols that live in the new zones.
  spawn("guard-14", 60, 20, [[60, 20], [72, 20], [72, 30], [60, 30]]),
  spawn("guard-15", 70, -40, [[70, -40], [84, -40], [84, -30], [70, -30]]),
  spawn("guard-16", -19, 30, [[-19, 30], [-19, 24], [2, 24], [2, 34]]),
];
export const SNIPER_SPAWNS: EnemySpawnDef[] = [
  { id: "sniper-central", kind: "sniper", pos: [0.5, 10.02, -19], yaw: Math.PI, patrol: [] },
  { id: "sniper-ne", kind: "sniper", pos: [55, 10.02, -54], yaw: Math.PI * 0.8, patrol: [] },
  { id: "sniper-far-nw", kind: "sniper", pos: [-114, 10.02, -124], yaw: Math.PI * 0.7, patrol: [] },
  { id: "sniper-far-e", kind: "sniper", pos: [114, 10.02, -20], yaw: Math.PI / 2, patrol: [] },
];
export const ALL_ENEMY_SPAWNS = [...ENEMY_SPAWNS, ...SNIPER_SPAWNS];

/** Motorised pursuit on the escape road: the fight sequence of the exfil. */
export const PURSUIT = {
  maxAlive: 4,
  maxTotal: 10,
  firstWave: 3,
  respawnDelay: 7,
  hp: 100,
  damage: 6,
  fireInterval: 1.35,
  range: 46,
  speed: 17.5,
  chaseSpeed: 24,
  accuracy: 0.05,
} as const;

export const TUNING = {
  player: { height: 1.8, radius: 0.34, eyeHeight: 1.7, walkSpeed: 5.2, sprintSpeed: 8.2, crouchSpeed: 2.5, accel: 14, airAccel: 3, friction: 12, gravity: 24, jumpSpeed: 7.6, ladderSpeed: 3.6, maxHealth: 100, regenDelay: 5, regenRate: 12 },
  rifle: { name: "AK-47", damage: 34, headshotMultiplier: 3, fireInterval: 0.12, magSize: 30, reserve: 120, reloadTime: 2, range: 220, spread: 0.007, moveSpread: 0.015, recoil: 0.008, auto: true },
  guard: { health: 100, damage: 5, fireInterval: 0.15, burstShots: 3, burstPause: [1.1, 2.1] as [number, number], reaction: 0.85, range: 29, speed: 2.1, accuracy: 0.038 },
  sniper: { health: 100, damage: 38, aimTime: 2.5, cooldown: 4.2, range: 74 },
} as const;
