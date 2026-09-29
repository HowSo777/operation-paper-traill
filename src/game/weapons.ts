/** Weapon inventory, ray spread, recoil, reloads and pooled ink tracers. */
import * as THREE from "three";
import { damp } from "./collision";
import { WEAPONS, shotSpread } from "./armament";
import { makeViewModel } from "./gunModels";
import { disposeObject, inkLineMaterial } from "./ink";
import type { PrimaryKind, Vec3, WeaponKind } from "./types";

export class Tracers {
  private pool: { line: THREE.Line; life: number }[] = [];
  private material: THREE.LineBasicMaterial;
  constructor(private scene: THREE.Scene, color = 0x111111) {
    this.material = inkLineMaterial(color);
    for (let i = 0; i < 48; i++) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geometry, this.material); line.visible = false; line.frustumCulled = false;
      scene.add(line); this.pool.push({ line, life: 0 });
    }
  }
  spawn(from: Vec3, to: Vec3, duration = .085): void {
    const item = this.pool.find(i => i.life <= 0) ?? this.pool[0];
    const buffer = item.line.geometry.getAttribute("position") as THREE.BufferAttribute;
    buffer.setXYZ(0, ...from); buffer.setXYZ(1, ...to); buffer.needsUpdate = true;
    item.life = duration; item.line.visible = true;
  }
  update(dt: number): void { this.pool.forEach(i => { i.life -= dt; i.line.visible = i.life > 0; }); }
  dispose(): void { this.pool.forEach(i => { this.scene.remove(i.line); i.line.geometry.dispose(); }); this.material.dispose(); }
}
export class ImpactMarks {
  private pool: { mesh: THREE.Mesh; life: number }[] = [];
  constructor(private scene: THREE.Scene) {
    for (let i = 0; i < 32; i++) {
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(.035, 5), new THREE.MeshBasicMaterial({ color: 0x282828, side: THREE.DoubleSide }));
      mesh.visible = false; scene.add(mesh); this.pool.push({ mesh, life: 0 });
    }
  }
  spawn(point: Vec3, normal: Vec3): void {
    const item = this.pool.find(i => i.life <= 0) ?? this.pool[0];
    const n = new THREE.Vector3(...normal);
    item.mesh.position.set(...point).addScaledVector(n, .012);
    item.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    item.life = 12; item.mesh.visible = true;
  }
  update(dt: number): void { this.pool.forEach(i => { i.life -= dt; i.mesh.visible = i.life > 0; }); }
  dispose(): void { this.pool.forEach(i => { this.scene.remove(i.mesh); disposeObject(i.mesh); }); }
}

export type AmmoState = { ammo: number; reserve: number };

/** Pure refill rule used on every death/redeploy. */
export function refillInventory(inventory: Map<WeaponKind, AmmoState>): void {
  for (const [kind, state] of inventory) {
    state.ammo = WEAPONS[kind].magSize;
    state.reserve = WEAPONS[kind].reserve;
  }
}
export type WeaponContext = { moving: boolean; sprinting: boolean; grounded: boolean; riding?: boolean };
const ADS_POS: Record<WeaponKind, [number, number, number]> = {
  rifle: [0, -0.143, -0.52],
  smg: [0, -0.143, -0.48],
  p90: [0, -0.143, -0.46],
  sniper: [0, -0.143, -0.52],
  awp: [0, -0.143, -0.54],
  shotgun: [0, -0.143, -0.55],
  pistol: [0, -0.15, -0.38],
  deagle: [0, -0.15, -0.40],
};
export class Weapon {
  group = new THREE.Group();
  muzzle: THREE.Object3D;
  kind: WeaponKind = "rifle";
  loadoutPrimary: PrimaryKind = "rifle";
  inventory = new Map<WeaponKind, AmmoState>();
  reloading = false;
  reloadProgress = 0;
  aiming = false;
  private cooldown = 0;
  private recoil = 0;
  private clock = 0;
  private flashTimer = 0;
  private flash: THREE.Object3D;
  private model: THREE.Group;
  private grounded = true;
  constructor(private camera: THREE.PerspectiveCamera, private onRecoil: (pitch: number, yaw: number) => void) {
    this.inventory.set("rifle", { ammo: 30, reserve: 120 });
    this.inventory.set("pistol", { ammo: 12, reserve: 72 });
    const vm = makeViewModel(this.kind); this.model = vm.group; this.muzzle = vm.muzzle;
    this.flash = this.model.userData.flash as THREE.Object3D;
    this.group.add(this.model); camera.add(this.group);
    this.group.position.set(.28, -.265, -.62); this.group.rotation.set(.045, .025, 0);
  }
  get spec() { return WEAPONS[this.kind]; }
  get ammo() { return this.inventory.get(this.kind)!.ammo; }
  set ammo(value: number) { this.inventory.get(this.kind)!.ammo = value; }
  get reserve() { return this.inventory.get(this.kind)!.reserve; }
  set reserve(value: number) { this.inventory.get(this.kind)!.reserve = value; }
  get displayName(): string { return this.spec.name; }
  /** True when the view should be a clean optic view instead of a gun viewmodel. */
  get scoped(): boolean { return this.aiming && (this.kind === "sniper" || this.kind === "awp"); }
  get canFire(): boolean { return this.cooldown <= 0 && !this.reloading && this.ammo > 0; }
  setLoadout(primary: PrimaryKind, secondary: "pistol" | "deagle" = "pistol"): void {
    this.loadoutPrimary = primary;
    this.inventory = new Map<WeaponKind, AmmoState>([
      [primary, { ammo: WEAPONS[primary].magSize, reserve: WEAPONS[primary].reserve }],
      [secondary, { ammo: WEAPONS[secondary].magSize, reserve: WEAPONS[secondary].reserve }],
    ]);
    if (this.kind !== primary) this.switchForce(primary);
    this.reloading = false; this.reloadProgress = 0; this.cooldown = 0; this.aiming = false;
  }
  refreshSkinModel(): void {
    this.switchForce(this.kind);
  }
  private switchForce(kind: WeaponKind): void {
    this.kind = kind; this.reloading = false; this.reloadProgress = 0; this.cooldown = .2;
    this.group.remove(this.model); disposeObject(this.model);
    const vm = makeViewModel(kind); this.model = vm.group; this.muzzle = vm.muzzle;
    this.flash = this.model.userData.flash as THREE.Object3D; this.group.add(this.model);
  }
  switch(kind: WeaponKind): boolean {
    if (!this.inventory.has(kind) || this.kind === kind) return false;
    this.switchForce(kind);
    return true;
  }
  pickup(kind: WeaponKind | "ammo"): string {
    if (kind === "ammo") {
      for (const [key, state] of this.inventory) state.reserve = Math.min(WEAPONS[key].reserve * 2, state.reserve + WEAPONS[key].magSize * 3);
      return "Ammunition collected";
    }
    if (this.inventory.has(kind)) {
      const state = this.inventory.get(kind)!;
      state.reserve = Math.min(WEAPONS[kind].reserve * 2, state.reserve + WEAPONS[kind].magSize * 3);
    } else this.inventory.set(kind, { ammo: WEAPONS[kind].magSize, reserve: WEAPONS[kind].reserve });
    this.switch(kind);
    return `${WEAPONS[kind].name} equipped`;
  }
  /** Refill every weapon currently owned; pickups remain in the inventory. */
  refillOwned(): void {
    refillInventory(this.inventory);
    this.reloading = false;
    this.reloadProgress = 0;
    this.cooldown = 0;
    this.recoil = 0;
    this.flashTimer = 0;
    this.flash.visible = false;
  }
  reset(): void {
    this.setLoadout(this.loadoutPrimary);
    this.refillOwned();
    this.group.visible = true;
  }
  fire(): boolean {
    if (!this.canFire) return false;
    this.ammo--; this.cooldown = this.spec.interval;
    this.recoil = Math.min(.06, this.recoil + .026); this.flashTimer = .045; this.flash.visible = true;
    this.onRecoil(this.spec.recoil * (this.aiming ? .5 : 1), (Math.random() - .5) * this.spec.recoil * .5);
    return true;
  }
  reload(): boolean {
    if (this.reloading || this.ammo >= this.spec.magSize || this.reserve <= 0) return false;
    this.reloading = true; this.reloadProgress = 0; return true;
  }
  spread(moving: boolean, sprinting: boolean): number {
    return shotSpread(this.kind, {
      aiming: this.aiming,
      moving,
      sprinting,
      grounded: this.grounded,
    });
  }
  update(dt: number, ctx: WeaponContext): void {
    this.clock += dt; this.cooldown = Math.max(0, this.cooldown - dt); this.grounded = ctx.grounded;
    this.flashTimer -= dt; this.flash.visible = this.flashTimer > 0;
    if (this.reloading) {
      this.reloadProgress += dt / this.spec.reloadTime;
      if (this.reloadProgress >= 1) {
        const rounds = Math.min(this.spec.magSize - this.ammo, this.reserve);
        this.ammo += rounds; this.reserve -= rounds; this.reloading = false; this.reloadProgress = 0;
      }
    }
    this.recoil = damp(this.recoil, 0, 11, dt);
    const ads = this.aiming && !this.reloading && !ctx.riding && this.kind !== "sniper";
    const bob = ads ? 0 : ctx.moving ? .009 : .0012;
    const reloadDip = this.reloading ? Math.sin(this.reloadProgress * Math.PI) : 0;
    // Sight plane is y = 0.125 on long guns. Parking the group at y = -0.125
    // puts the notch and front post on the camera centreline.
    const hip = ctx.riding
      ? new THREE.Vector3(.34, -.33, -.78)
      : new THREE.Vector3(.28, -.265, -.62);
    const adsPos = ADS_POS[this.kind];
    const target = ads ? new THREE.Vector3(...adsPos) : hip;
    if (!ads) {
      target.y += Math.sin(this.clock * 9) * bob - reloadDip * .21;
      target.x += Math.cos(this.clock * 4.5) * bob;
    }
    target.z += this.recoil * (ads ? 0.35 : 1);
    this.group.position.lerp(target, 1 - Math.exp(-13 * dt));
    this.group.rotation.x = damp(this.group.rotation.x, (ads ? 0 : ctx.riding ? -.02 : .045) + this.recoil - reloadDip * .45, 14, dt);
    this.group.rotation.y = damp(this.group.rotation.y, ads ? 0 : .025, 14, dt);
    this.group.rotation.z = damp(this.group.rotation.z, ads ? 0 : reloadDip * .27 + (ctx.sprinting ? -.12 : 0), 13, dt);
  }
  dispose(): void { this.camera.remove(this.group); disposeObject(this.group); }
}
export function applySpread(dir: Vec3, spread: number): Vec3 {
  const v = new THREE.Vector3(...dir).normalize();
  const helper = Math.abs(v.y) > .95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(v, helper).normalize();
  const up = new THREE.Vector3().crossVectors(right, v).normalize();
  const angle = Math.random() * Math.PI * 2, radius = Math.sqrt(Math.random()) * spread;
  v.addScaledVector(right, Math.cos(angle) * radius).addScaledVector(up, Math.sin(angle) * radius).normalize();
  return [v.x, v.y, v.z];
}
