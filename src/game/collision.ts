/**
 * Minimal collision / raycasting maths shared by the client (player movement,
 * AI, hit detection) and the server. Pure functions, no Three.js.
 */

import type { AABB, BoxDef, Vec3 } from "./types";

const EPS = 1e-3;

export function boxToAabb(box: BoxDef): AABB {
  return {
    min: [
      box.pos[0] - box.size[0] / 2,
      box.pos[1] - box.size[1] / 2,
      box.pos[2] - box.size[2] / 2,
    ],
    max: [
      box.pos[0] + box.size[0] / 2,
      box.pos[1] + box.size[1] / 2,
      box.pos[2] + box.size[2] / 2,
    ],
  };
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return (
    a.min[0] < b.max[0] &&
    a.max[0] > b.min[0] &&
    a.min[1] < b.max[1] &&
    a.max[1] > b.min[1] &&
    a.min[2] < b.max[2] &&
    a.max[2] > b.min[2]
  );
}

/** AABB for an upright actor whose feet are at `pos`. */
export function actorBox(pos: Vec3, half: Vec3, height: number): AABB {
  return {
    min: [pos[0] - half[0], pos[1], pos[2] - half[2]],
    max: [pos[0] + half[0], pos[1] + height, pos[2] + half[2]],
  };
}

export type RayHit = {
  /** Distance along the (normalised) direction. */
  t: number;
  point: Vec3;
  normal: Vec3;
};

/** Slab method ray/AABB test. `dir` must be normalised. Returns null on miss. */
export function rayAabb(
  origin: Vec3,
  dir: Vec3,
  box: AABB,
  maxT: number,
): RayHit | null {
  let tmin = 0;
  let tmax = maxT;
  let hitAxis = 0;
  let hitSign = -1;

  for (let axis = 0; axis < 3; axis++) {
    const d = dir[axis];
    const o = origin[axis];
    if (Math.abs(d) < 1e-8) {
      if (o < box.min[axis] || o > box.max[axis]) return null;
      continue;
    }
    const inv = 1 / d;
    let t1 = (box.min[axis] - o) * inv;
    let t2 = (box.max[axis] - o) * inv;
    let sign = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      sign = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      hitAxis = axis;
      hitSign = sign;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }

  const normal: Vec3 = [0, 0, 0];
  normal[hitAxis] = hitSign;
  return {
    t: tmin,
    point: [
      origin[0] + dir[0] * tmin,
      origin[1] + dir[1] * tmin,
      origin[2] + dir[2] * tmin,
    ],
    normal,
  };
}

/** Ray against a list of boxes, nearest hit wins. */
export function raycastBoxes(
  origin: Vec3,
  dir: Vec3,
  boxes: AABB[],
  maxT = 500,
): (RayHit & { box: AABB }) | null {
  let best: (RayHit & { box: AABB }) | null = null;
  for (const box of boxes) {
    const hit = rayAabb(origin, dir, box, best ? best.t : maxT);
    if (hit) best = { ...hit, box };
  }
  return best;
}

/** True when nothing solid sits between the two points. */
export function hasLineOfSight(
  from: Vec3,
  to: Vec3,
  boxes: AABB[],
): boolean {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-6) return true;
  const dir: Vec3 = [dx / dist, dy / dist, dz / dist];
  const hit = raycastBoxes(from, dir, boxes, dist - 0.05);
  return hit === null;
}

export type MoveResult = {
  grounded: boolean;
  hitWall: boolean;
};

/**
 * Axis separated AABB sweep used for the player capsule and the AI actors.
 * Mutates `pos` / `vel`. `pos[1]` is the feet height.
 */
export function moveAndCollide(
  pos: Vec3,
  half: Vec3,
  height: number,
  vel: Vec3,
  dt: number,
  boxes: AABB[],
): MoveResult {
  let grounded = false;
  let hitWall = false;

  const sweep = (axis: 0 | 1 | 2) => {
    if (vel[axis] === 0) return;
    pos[axis] += vel[axis] * dt;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (
        pos[0] + half[0] <= b.min[0] ||
        pos[0] - half[0] >= b.max[0] ||
        pos[1] + height <= b.min[1] ||
        pos[1] >= b.max[1] ||
        pos[2] + half[2] <= b.min[2] ||
        pos[2] - half[2] >= b.max[2]
      ) {
        continue;
      }
      // Overlapping: push out along the movement axis.
      if (vel[axis] > 0) {
        pos[axis] =
          axis === 1 ? b.min[1] - height - EPS : b.min[axis] - half[axis] - EPS;
      } else {
        pos[axis] = axis === 1 ? b.max[1] + EPS : b.max[axis] + half[axis] + EPS;
        if (axis === 1) grounded = true;
      }
      if (axis !== 1) hitWall = true;
      vel[axis] = 0;
    }
  };

  sweep(0);
  sweep(1);
  sweep(2);
  return { grounded, hitWall };
}

/** Shortest signed distance from a point to an AABB surface (0 when inside). */
export function distanceToBox(point: Vec3, box: AABB): number {
  const dx = Math.max(
    box.min[0] - point[0],
    0,
    point[0] - box.max[0],
  );
  const dy = Math.max(box.min[1] - point[1], 0, point[1] - box.max[1]);
  const dz = Math.max(box.min[2] - point[2], 0, point[2] - box.max[2]);
  return Math.hypot(dx, dy, dz);
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Frame-rate independent exponential smoothing. */
export function damp(a: number, b: number, rate: number, dt: number): number {
  return lerp(a, b, 1 - Math.exp(-rate * dt));
}

export function normalizeVec(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/** Smallest absolute angular difference in radians. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
