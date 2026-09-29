/** Motorised pursuit AI along the escape road — render-independent. */
import { clamp, hasLineOfSight, rayAabb } from "./collision";
import { PURSUIT } from "./mapData";
import type { AABB, Vec3 } from "./types";

export type RoadPath = { points: Vec3[]; length: number; at(distance: number): { pos: Vec3; heading: number } };

export function makeRoadPath(points: Vec3[]): RoadPath {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][2] - points[i - 1][2]));
  }
  return {
    points: points.map(p => [...p] as Vec3),
    length: cumulative[cumulative.length - 1],
    at(distance: number) {
      const d = clamp(distance, 0, cumulative[cumulative.length - 1]);
      let index = 1;
      while (index < cumulative.length - 1 && cumulative[index] < d) index++;
      const a = points[index - 1], b = points[index];
      const span = cumulative[index] - cumulative[index - 1] || 1;
      const k = (d - cumulative[index - 1]) / span;
      return {
        pos: [a[0] + (b[0] - a[0]) * k, 0.02, a[2] + (b[2] - a[2]) * k] as Vec3,
        heading: Math.atan2(-(b[0] - a[0]), -(b[2] - a[2])),
      };
    },
  };
}

/** Distance along the road nearest to an arbitrary world position. */
export function projectOnRoad(path: RoadPath, pos: Vec3): { distance: number; lateral: number } {
  let best = { distance: 0, lateral: 0 };
  let bestGap = Infinity;
  for (let d = 0; d <= path.length; d += 4) {
    const point = path.at(d).pos;
    const gap = Math.hypot(point[0] - pos[0], point[2] - pos[2]);
    if (gap < bestGap) { bestGap = gap; best = { distance: d, lateral: gap }; }
  }
  return best;
}

export type PursuerState = {
  id: string;
  lane: number;
  distance: number;
  pos: Vec3;
  heading: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  cooldown: number;
  wheelAngle: number;
  recoil: number;
  firing: boolean;
  ace: boolean;
  damage: number;
};

export type PursuitEvents = {
  /** A pursuer pulled the trigger; draw the tracer and resolve the damage. */
  onShot: (pursuer: PursuerState, origin: Vec3, dir: Vec3) => void;
  onKilled: (pursuer: PursuerState) => void;
};

export class Pursuit {
  entries: PursuerState[] = [];
  spawned = 0;
  private nextId = 1;
  private spawnTimer = 0;
  constructor(private path: RoadPath) {}
  get alive(): number { return this.entries.filter(e => e.alive).length; }
  reset(): void { this.entries = []; this.spawned = 0; this.spawnTimer = 0; }

  spawn(playerDistance: number): PursuerState | null {
    if (this.spawned >= PURSUIT.maxTotal || this.alive >= PURSUIT.maxAlive) return null;
    // Behind the rider when there is road behind them, ahead (roadblock style)
    // at the start of the run, where they fall back and join the chase.
    const behind = playerDistance > 34;
    const distance = clamp(playerDistance + (behind ? -22 - Math.random() * 14 : 34 + Math.random() * 12), 2, this.path.length - 2);
    const lane = (this.spawned % 2 ? 1 : -1) * (1.4 + Math.random());
    const { pos, heading } = this.path.at(distance);
    // Every fourth rider is an ace: tougher, faster and meaner.
    const ace = this.spawned > 0 && this.spawned % 4 === 3;
    const hp = ace ? 170 : PURSUIT.hp;
    const entry: PursuerState = {
      id: `rider-${this.nextId++}`, lane, distance, pos: [pos[0], pos[1], pos[2]], heading,
      hp, maxHp: hp, alive: true, cooldown: 0.8 + Math.random(), wheelAngle: 0, recoil: 0, firing: false,
      ace, damage: ace ? 9 : PURSUIT.damage,
    };
    this.entries.push(entry); this.spawned++;
    return entry;
  }

  update(dt: number, playerPos: Vec3, playerAlive: boolean, path: RoadPath, events: PursuitEvents): void {
    const playerRun = projectOnRoad(path, playerPos);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.spawned < PURSUIT.maxTotal && this.alive < PURSUIT.maxAlive) {
      if (this.spawn(playerRun.distance)) this.spawnTimer = PURSUIT.respawnDelay;
      else this.spawnTimer = 2;
    }
    for (const e of this.entries) {
      e.recoil = Math.max(0, e.recoil - dt * 5);
      if (!e.alive) continue;
      // Close in from behind, but never teleport past the rider.
      const gap = playerRun.distance - 6 - e.distance;
      const chase = e.ace ? PURSUIT.chaseSpeed + 2.5 : PURSUIT.chaseSpeed;
      const cruise = e.ace ? PURSUIT.speed + 1.5 : PURSUIT.speed;
      const speed = gap > 3 ? chase : gap < -3 ? cruise * .7 : cruise;
      e.distance = clamp(e.distance + speed * dt, 2, path.length - 1);
      const at = path.at(e.distance);
      const lateral = e.lane;
      e.heading = at.heading;
      e.pos = [
        at.pos[0] + Math.cos(at.heading) * lateral,
        at.pos[1],
        at.pos[2] - Math.sin(at.heading) * lateral,
      ];
      e.wheelAngle += speed * dt / 0.42;
      e.cooldown = Math.max(0, e.cooldown - dt);
      e.firing = false;
      const dx = playerPos[0] - e.pos[0], dz = playerPos[2] - e.pos[2];
      const distance = Math.hypot(dx, dz);
      if (!playerAlive || distance > PURSUIT.range) continue;
      const origin: Vec3 = [e.pos[0], e.pos[1] + 1.35, e.pos[2]];
      const target: Vec3 = [playerPos[0], playerPos[1] + 1.05, playerPos[2]];
      if (!hasLineOfSight(origin, target, [])) continue;
      e.heading = Math.atan2(-dx, -dz);
      if (e.cooldown === 0) {
        e.cooldown = e.ace ? PURSUIT.fireInterval * 0.7 : PURSUIT.fireInterval;
        e.firing = true; e.recoil = 1;
        const length = Math.hypot(dx, dz) || 1;
        const dir: Vec3 = [
          dx / length + (Math.random() - .5) * PURSUIT.accuracy * 2,
          (target[1] - origin[1]) / length + (Math.random() - .5) * PURSUIT.accuracy * 2,
          dz / length + (Math.random() - .5) * PURSUIT.accuracy * 2,
        ];
        const norm = Math.hypot(...dir) || 1;
        events.onShot(e, origin, dir.map(v => v / norm) as Vec3);
      }
    }
  }

  raycast(origin: Vec3, dir: Vec3, maxT: number): { id: string; distance: number; point: Vec3 } | null {
    let best: { id: string; distance: number; point: Vec3 } | null = null;
    for (const e of this.entries) {
      if (!e.alive) continue;
      const box: AABB = { min: [e.pos[0] - .5, e.pos[1], e.pos[2] - .5], max: [e.pos[0] + .5, e.pos[1] + 1.8, e.pos[2] + .5] };
      const hit = rayAabb(origin, dir, box, best?.distance ?? maxT);
      if (hit) best = { id: e.id, distance: hit.t, point: hit.point };
    }
    return best;
  }

  damage(id: string, amount: number): { killed: boolean; pursuer: PursuerState } | null {
    const entry = this.entries.find(e => e.id === id);
    if (!entry || !entry.alive) return null;
    entry.hp -= amount;
    if (entry.hp <= 0) { entry.alive = false; return { killed: true, pursuer: entry }; }
    return { killed: false, pursuer: entry };
  }
}
