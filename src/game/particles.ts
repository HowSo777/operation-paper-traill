/** Lightweight pooled particle bursts: muzzle sparks, impacts, dust, paint. */
import * as THREE from "three";
import type { Vec3 } from "./types";

export type BurstOpts = {
  count?: number;
  color?: number;
  color2?: number;
  speed?: number;
  up?: number;
  life?: number;
  gravity?: number;
  size?: number;
};

const MAX = 380;

export class Particles {
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private grav = new Float32Array(MAX);
  private active = new Set<number>();
  private cursor = 0;
  private geo = new THREE.BufferGeometry();
  private points: THREE.Points;
  private tmp = new THREE.Color();
  private tmp2 = new THREE.Color();

  constructor(private scene: THREE.Scene) {
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -999;
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.11,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  burst(p: Vec3, opts: BurstOpts = {}): void {
    const count = opts.count ?? 8;
    const speed = opts.speed ?? 4;
    const up = opts.up ?? 2;
    const life = opts.life ?? 0.5;
    const gravity = opts.gravity ?? 9;
    this.tmp.set(opts.color ?? 0x333333);
    this.tmp2.set(opts.color2 ?? opts.color ?? 0x999999);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX;
      if (this.active.size >= MAX) this.active.delete(i);
      this.active.add(i);
      const a = Math.random() * Math.PI * 2;
      const r = (0.3 + Math.random() * 0.7) * speed;
      this.pos[i * 3] = p[0];
      this.pos[i * 3 + 1] = p[1];
      this.pos[i * 3 + 2] = p[2];
      this.vel[i * 3] = Math.cos(a) * r;
      this.vel[i * 3 + 1] = Math.random() * up + 0.5;
      this.vel[i * 3 + 2] = Math.sin(a) * r;
      const c = this.tmp.clone().lerp(this.tmp2, Math.random());
      this.col[i * 3] = c.r;
      this.col[i * 3 + 1] = c.g;
      this.col[i * 3 + 2] = c.b;
      this.maxLife[i] = life * (0.6 + Math.random() * 0.8);
      this.life[i] = this.maxLife[i];
      this.grav[i] = gravity;
    }
    (this.geo.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
  }

  update(dt: number): void {
    if (this.active.size === 0) return;
    let any = false;
    // Iterate only live particles. Most gameplay frames have no active burst;
    // scan cost is now O(live particles), not O(the 380-slot pool).
    for (const i of this.active) {
      if (this.life[i] <= 0) { this.active.delete(i); continue; }
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -999;
        this.active.delete(i);
        continue;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02) {
        this.pos[i * 3 + 1] = 0.02;
        this.vel[i * 3 + 1] = 0;
        this.vel[i * 3] *= 0.9;
        this.vel[i * 3 + 2] *= 0.9;
      }
    }
    if (any) (this.geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  }

  clear(): void {
    this.life.fill(0);
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -999;
    (this.geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.scene.remove(this.points);
    this.geo.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
