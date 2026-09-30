/**
 * Enemy manager: spawns, animates and resolves combat for the SMG guards and
 * the tower snipers, and exposes raycast hit tests for the player's weapon.
 */

import * as THREE from "three";
import {
  createEnemy,
  enemyBulletHitsPlayer,
  updateEnemy,
  type AiEvents,
  type EnemyState,
} from "./ai";
import { makeHumanoid, type Humanoid } from "./actors";
import { inkLineMaterial } from "./ink";
import { rayAabb } from "./collision";
import { ALL_ENEMY_SPAWNS, TUNING, getBlockerAabbs, getSolidAabbs } from "./mapData";
import type { AABB, EnemySpawnDef, Vec3 } from "./types";

export type EnemyHit = {
  id: string;
  headshot: boolean;
  distance: number;
  point: Vec3;
  normal: Vec3;
  pos: Vec3;
};

export type EnemyManagerEvents = {
  onEnemyShot: (enemy: EnemyState, origin: Vec3, dir: Vec3, damage: number) => void;
  onEnemyKilled: (enemy: EnemyState, headshot: boolean) => void;
};

type EnemyEntry = {
  state: EnemyState;
  visual: Humanoid;
  flash: number;
  laser: THREE.Line | null;
  flashMesh: THREE.Mesh | null;
};

const GUARD_HALF = 0.42;
const BODY_HEIGHT = 1.5;

function enemyBoxes(e: EnemyState): { head: AABB; body: AABB } {
  const x = e.pos[0];
  const z = e.pos[2];
  const base = e.pos[1];
  return {
    head: {
      min: [x - 0.19, base + 1.5, z - 0.19],
      max: [x + 0.19, base + 1.78, z + 0.19],
    },
    body: {
      min: [x - GUARD_HALF, base, z - 0.3],
      max: [x + GUARD_HALF, base + BODY_HEIGHT, z + 0.3],
    },
  };
}

export class EnemyManager {
  private entries: EnemyEntry[] = [];
  private spawns: EnemySpawnDef[];
  private blockers = getBlockerAabbs();
  private aiEvents: AiEvents;
  private laserMaterial: THREE.LineBasicMaterial;

  constructor(
    private scene: THREE.Scene,
    private events: EnemyManagerEvents,
    spawns: EnemySpawnDef[] = ALL_ENEMY_SPAWNS,
  ) {
    this.spawns = spawns;
    this.laserMaterial = new THREE.LineBasicMaterial({ color: 0x0a0a0a });
    this.aiEvents = {
      onGuardShot: (enemy, origin, dir) => {
        this.noteShot(enemy.id, origin, dir);
        this.events.onEnemyShot(enemy, origin, dir, TUNING.guard.damage);
      },
      onSniperShot: (enemy, origin, dir) => {
        this.noteShot(enemy.id, origin, dir);
        this.events.onEnemyShot(enemy, origin, dir, TUNING.sniper.damage);
      },
      onNoise: () => {},
    };

    for (const spawn of this.spawns) {
      const state = createEnemy(
        spawn.id,
        spawn.kind,
        spawn.pos,
        spawn.yaw,
        spawn.patrol,
        spawn.kind === "guard" ? TUNING.guard.health : TUNING.sniper.health,
      );
      const visual = makeHumanoid({
        hatchScale: spawn.kind === "guard" ? 1.5 : 1.1,
        weapon: spawn.kind === "guard" ? "smg" : "sniper",
        armPose: spawn.kind === "guard" ? "hold" : "hold",
      });
      scene.add(visual.group);

      let laser: THREE.Line | null = null;
      let flashMesh: THREE.Mesh | null = null;
      if (visual.weapon) {
        flashMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.16, 0.16),
          new THREE.MeshBasicMaterial({ color: 0x0a0a0a }),
        );
        flashMesh.position.set(0, 0, -0.62);
        flashMesh.visible = false;
        visual.weapon.add(flashMesh);
      }
      if (spawn.kind === "sniper") {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
        laser = new THREE.Line(geo, this.laserMaterial);
        laser.visible = false;
        laser.frustumCulled = false;
        scene.add(laser);
      }

      this.entries.push({ state, visual, flash: 0, laser, flashMesh });
    }
  }

  get enemies(): EnemyState[] {
    return this.entries.map((e) => e.state);
  }

  aliveCount(): number {
    return this.entries.filter((e) => e.state.alive).length;
  }

  /** Lightweight positions for the minimap. */
  snapshot(): { x: number; z: number; alive: boolean; sniper: boolean }[] {
    return this.entries.map((e) => ({
      x: e.state.pos[0],
      z: e.state.pos[2],
      alive: e.state.alive,
      sniper: e.state.kind === "sniper",
    }));
  }

  /** Closest sniper currently lining up a shot (0..1) for the HUD warning. */
  sniperAim(): number | null {
    let best: number | null = null;
    for (const entry of this.entries) {
      if (entry.state.kind !== "sniper" || !entry.state.alive) continue;
      if (entry.state.aimProgress > 0.05) {
        best = best === null ? entry.state.aimProgress : Math.max(best, entry.state.aimProgress);
      }
    }
    return best;
  }

  alertNear(position: Vec3, radius: number): void {
    for (const entry of this.entries) {
      const s = entry.state;
      if (!s.alive || s.kind !== "guard") continue;
      const d = Math.hypot(s.pos[0] - position[0], s.pos[2] - position[2]);
      if (d < radius && s.mode === "patrol") {
        s.mode = "alert";
        s.reaction = TUNING.guard.reaction * 0.5;
        s.lastKnown = [...position] as Vec3;
      }
    }
  }

  /** Ray test against every living enemy (head + body boxes). */
  raycast(origin: Vec3, dir: Vec3, maxT: number): EnemyHit | null {
    let best: EnemyHit | null = null;
    for (const entry of this.entries) {
      if (!entry.state.alive) continue;
      const boxes = enemyBoxes(entry.state);
      const candidates: { box: AABB; head: boolean }[] = [
        { box: boxes.head, head: true },
        { box: boxes.body, head: false },
      ];
      for (const { box, head } of candidates) {
        const hit = rayAabb(origin, dir, box, best ? best.distance : maxT);
        if (hit) {
          best = {
            id: entry.state.id,
            headshot: head,
            distance: hit.t,
            point: hit.point,
            normal: hit.normal,
            pos: [...entry.state.pos],
          };
        }
      }
    }
    return best;
  }

  /** Apply damage; returns true when this shot killed the enemy. */
  damage(id: string, amount: number): { killed: boolean; headshot: boolean; enemy: EnemyState } | null {
    const entry = this.entries.find((e) => e.state.id === id);
    if (!entry || !entry.state.alive) return null;
    entry.state.hp -= amount;
    entry.flash = 0.12;
    if (entry.state.hp <= 0) {
      entry.state.alive = false;
      entry.state.hp = 0;
      entry.state.deathTime = 0;
      return { killed: true, headshot: amount >= TUNING.rifle.damage * 1.5, enemy: entry.state };
    }
    return { killed: false, headshot: false, enemy: entry.state };
  }

  /** Resolve an enemy bullet against the player; returns damage dealt. */
  resolveBullet(origin: Vec3, dir: Vec3, playerPos: Vec3, playerAlive: boolean): number {
    if (!playerAlive) return 0;
    const { hit } = enemyBulletHitsPlayer(origin, dir, playerPos, this.blockers);
    return hit ? 1 : 0;
  }

  update(dt: number, playerPos: Vec3, playerAlive: boolean, onPlayerHit: (damage: number, from: Vec3) => void): void {
    const world = { blockers: this.blockers, solids: getSolidAabbs(), playerPos, playerAlive };
    for (const entry of this.entries) {
      const s = entry.state;
      updateEnemy(s, world, this.aiEvents, dt, {
        guard: TUNING.guard,
        sniper: TUNING.sniper,
      });

      // Resolve the shot the AI just asked for.
      if (s.justFired) {
        const dir = this.lastShotDir.get(s.id);
        if (dir) {
          const damage = s.kind === "guard" ? TUNING.guard.damage : TUNING.sniper.damage;
          const origin = this.lastShotOrigin.get(s.id) ?? [s.pos[0], s.pos[1] + 1.5, s.pos[2]];
          const resolved = this.resolveBullet(origin, dir, playerPos, playerAlive);
          if (resolved > 0) onPlayerHit(damage, [...s.pos] as Vec3);
        }
      }

      this.updateVisual(entry, dt);
    }
  }

  private lastShotOrigin = new Map<string, Vec3>();
  private lastShotDir = new Map<string, Vec3>();

  private updateVisual(entry: EnemyEntry, dt: number): void {
    const s = entry.state;
    const g = entry.visual.group;
    g.position.set(s.pos[0], s.pos[1], s.pos[2]);
    g.rotation.y = s.yaw;

    if (s.alive) {
      const swing = Math.sin(s.legPhase) * Math.min(0.7, s.speed * 0.22);
      entry.visual.hipL.rotation.x = swing;
      entry.visual.hipR.rotation.x = -swing;
      g.rotation.x = 0;
      g.position.y = s.pos[1];
      entry.flash = Math.max(0, entry.flash - dt);
      const pop = entry.flash > 0 ? 1.12 : 1;
      g.scale.setScalar(pop);
      if (entry.flashMesh) entry.flashMesh.visible = s.muzzleFlash > 0.5;
    } else {
      // Topple over.
      const k = Math.min(1, s.deathTime);
      g.rotation.x = -k * Math.PI * 0.5;
      g.position.y = s.pos[1] + k * 0.05;
      entry.visual.hipL.rotation.x = 0;
      entry.visual.hipR.rotation.x = 0;
      if (entry.flashMesh) entry.flashMesh.visible = false;
    }

    if (entry.laser) {
      if (s.alive && s.kind === "sniper" && s.aimProgress > 0.08) {
        const from: Vec3 = [s.pos[0], s.pos[1] + 1.5, s.pos[2]];
        const cp = Math.cos(s.pitch);
        const dir: Vec3 = [-Math.sin(s.yaw) * cp, Math.sin(s.pitch), -Math.cos(s.yaw) * cp];
        const pos = entry.laser.geometry.getAttribute("position") as THREE.BufferAttribute;
        pos.setXYZ(0, from[0], from[1], from[2]);
        pos.setXYZ(1, from[0] + dir[0] * 90, from[1] + dir[1] * 90, from[2] + dir[2] * 90);
        pos.needsUpdate = true;
        entry.laser.visible = true;
      } else {
        entry.laser.visible = false;
      }
    }
  }

  /** Record the shot the AI requested (called from the AI event bridge). */
  noteShot(id: string, origin: Vec3, dir: Vec3): void {
    this.lastShotOrigin.set(id, origin);
    this.lastShotDir.set(id, dir);
  }

  /** Restore every enemy to its spawn state (used by "run it again"). */
  reset(): void {
    this.entries.forEach((entry, index) => {
      const spawn = this.spawns[index];
      if (!spawn) return;
      entry.state = createEnemy(
        spawn.id,
        spawn.kind,
        spawn.pos,
        spawn.yaw,
        spawn.patrol,
        spawn.kind === "guard" ? TUNING.guard.health : TUNING.sniper.health,
      );
      entry.flash = 0;
      entry.visual.group.scale.setScalar(1);
      entry.visual.group.rotation.set(0, spawn.yaw, 0);
      if (entry.laser) entry.laser.visible = false;
      if (entry.flashMesh) entry.flashMesh.visible = false;
    });
  }

  dispose(): void {
    for (const entry of this.entries) {
      this.scene.remove(entry.visual.group);
      if (entry.laser) {
        this.scene.remove(entry.laser);
        entry.laser.geometry.dispose();
      }
    }
    this.entries = [];
    this.laserMaterial.dispose();
  }
}
