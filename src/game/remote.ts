/** Remote players: enemies are always red, teammates always blue to local eyes. */
import * as THREE from "three";
import { makeBike, makeHumanoid, type Humanoid } from "./actors";
import { makeGun } from "./gunModels";
import { disposeObject, textSprite } from "./ink";
import { angleDelta, damp, rayAabb } from "./collision";
import { TEAM_META } from "./teams";
import type { PlayerSnapshot } from "./protocol";
import type { AABB, TeamOrSpectator, Vec3, WeaponKind } from "./types";

type Remote = {
  snapshot: PlayerSnapshot; visual: Humanoid; tag: THREE.Sprite; bike: THREE.Group;
  render: Vec3; yaw: number; phase: number; weapon: WeaponKind;
  team: TeamOrSpectator; marker: THREE.Mesh; enemy: boolean;
};
const ALLY = TEAM_META.blue.color;
const ENEMY = TEAM_META.red.color;

export class RemotePlayers {
  private entries = new Map<string, Remote>();
  private localTeam: TeamOrSpectator = "blue";
  constructor(private scene: THREE.Scene) { }
  get count(): number { return this.entries.size; }

  setLocalTeam(team: TeamOrSpectator): void {
    if (team === this.localTeam) return;
    this.localTeam = team;
    // Rebuild in the new relationship palette. This happens only once after
    // server assignment, never every frame.
    const snapshots = [...this.entries.values()].map(e => e.snapshot);
    for (const id of [...this.entries.keys()]) this.remove(id);
    for (const snapshot of snapshots) this.add(snapshot);
  }

  private isEnemy(team: TeamOrSpectator): boolean {
    return team !== "spectator" && this.localTeam !== "spectator" && team !== this.localTeam;
  }

  private add(p: PlayerSnapshot): Remote {
    const enemy = this.isEnemy(p.team);
    const color = enemy ? ENEMY : ALLY;
    const visual = makeHumanoid({ weapon: p.weapon ?? "rifle", color });
    const tag = textSprite(`${enemy ? "ENEMY" : "ALLY"} · ${p.name}`);
    tag.position.set(0, 2.12, 0);
    tag.scale.set(enemy ? 2.35 : 2.0, .29, 1);
    visual.group.add(tag);
    this.scene.add(visual.group);
    // Opponents get a bright red overhead diamond. Allies get a lower blue disc.
    const marker = enemy
      ? new THREE.Mesh(new THREE.OctahedronGeometry(.13), new THREE.MeshBasicMaterial({ color: ENEMY, depthTest: false, depthWrite: false }))
      : new THREE.Mesh(new THREE.CircleGeometry(.34, 16), new THREE.MeshBasicMaterial({ color: ALLY, transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide }));
    if (enemy) {
      marker.position.y = 2.38;
      marker.renderOrder = 20;
    } else {
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = .025;
    }
    visual.group.add(marker);
    const bike = makeBike(); bike.visible = false; this.scene.add(bike);
    const entry: Remote = { snapshot: p, visual, tag, bike, render: [...p.pos], yaw: p.yaw, phase: 0, weapon: p.weapon ?? "rifle", team: p.team, marker, enemy };
    this.entries.set(p.id, entry); return entry;
  }
  private remove(id: string): void {
    const e = this.entries.get(id); if (!e) return;
    this.scene.remove(e.visual.group, e.bike); disposeObject(e.visual.group); disposeObject(e.bike); this.entries.delete(id);
  }
  sync(players: PlayerSnapshot[]): void {
    const seen = new Set<string>();
    for (const p of players) {
      seen.add(p.id);
      const existing = this.entries.get(p.id);
      const enemy = this.isEnemy(p.team);
      if (existing && (existing.team !== p.team || existing.enemy !== enemy)) { this.remove(p.id); this.add(p); }
      else (existing ?? this.add(p)).snapshot = p;
    }
    for (const id of this.entries.keys()) if (!seen.has(id)) this.remove(id);
  }
  update(dt: number, localPos?: Vec3): void {
    for (const e of this.entries.values()) {
      const p = e.snapshot;
      for (let i = 0; i < 3; i++) e.render[i] = damp(e.render[i], p.pos[i], 18, dt);
      e.yaw += angleDelta(e.yaw, p.yaw) * (1 - Math.exp(-16 * dt));
      const model = e.visual.group; model.position.set(...e.render); model.rotation.set(p.alive ? 0 : -Math.PI / 2, e.yaw, 0);
      const near = localPos && Math.hypot(e.render[0] - localPos[0], e.render[2] - localPos[2]) < .8;
      model.visible = !near && p.team !== "spectator";
      e.tag.visible = p.alive && p.team !== "spectator";
      e.marker.visible = p.alive && !p.riding;
      const weapon = p.weapon ?? "rifle";
      if (weapon !== e.weapon) {
        if (e.visual.weapon) { model.remove(e.visual.weapon); disposeObject(e.visual.weapon); }
        const gun = makeGun(weapon, false); gun.scale.setScalar(.78); gun.position.set(.18, 1.15, -.2); model.add(gun); e.visual.weapon = gun; e.weapon = weapon;
      }
      if (e.visual.weapon) e.visual.weapon.visible = !p.riding;
      e.bike.visible = Boolean(p.riding && p.alive && !near && p.team !== "spectator"); e.bike.position.set(...e.render); e.bike.rotation.y = e.yaw;
      if (p.moving) e.phase += dt * (p.riding ? 22 : 8);
      if (p.riding) {
        model.position.y += .27; e.visual.hipL.rotation.x = -1; e.visual.hipR.rotation.x = -1;
        const wheels = e.bike.userData.wheels as THREE.Group[]; wheels.forEach(w => w.rotation.x = -e.phase);
      } else {
        const swing = Math.sin(e.phase) * (p.moving ? .55 : 0); e.visual.hipL.rotation.x = swing; e.visual.hipR.rotation.x = -swing;
      }
      e.visual.head.rotation.x = -p.pitch * .6;
      if (e.enemy) e.marker.rotation.y += dt * 1.8;
    }
  }
  getSnapshot(id: string): PlayerSnapshot | undefined { return this.entries.get(id)?.snapshot; }
  removePlayer(id: string): void { this.remove(id); }
  raycast(origin: Vec3, dir: Vec3, maxT: number, myTeam?: TeamOrSpectator): { id: string; distance: number; point: Vec3 } | null {
    let best: { id: string; distance: number; point: Vec3 } | null = null;
    for (const [id, e] of this.entries) {
      if (!e.snapshot.alive || e.snapshot.protected || e.snapshot.team === myTeam || e.snapshot.team === "spectator") continue;
      const p = e.render, box: AABB = { min: [p[0] - .4, p[1], p[2] - .4], max: [p[0] + .4, p[1] + 1.8, p[2] + .4] };
      const hit = rayAabb(origin, dir, box, best?.distance ?? maxT);
      if (hit) best = { id, distance: hit.t, point: hit.point };
    }
    return best;
  }
  dispose(): void { for (const id of [...this.entries.keys()]) this.remove(id); }
}
