/** Low-poly personnel and a mechanically recognisable motorcycle. */
import * as THREE from "three";
import { batchInk, beam, inkBox, inkify, inkLineMaterial, line } from "./ink";
import { makeGun } from "./gunModels";
import type { Vec3, WeaponKind } from "./types";
export { makeViewModel } from "./gunModels";
export const makeSmg = () => makeGun("smg");
export const makeAssaultRifle = () => makeGun("rifle");
export const makeSniperRifle = () => makeGun("sniper");
export type ArmPose = "hold" | "up" | "relaxed";
export type Humanoid = { group: THREE.Group; hipL: THREE.Group; hipR: THREE.Group; shoulderL: THREE.Group; shoulderR: THREE.Group; head: THREE.Group; torso: THREE.Group; weapon: THREE.Group | null };
export type HumanoidOptions = { hatchScale?: number; armPose?: ArmPose; weapon?: WeaponKind | null; visor?: boolean; color?: number };

export function makeHumanoid(options: HumanoidOptions = {}): Humanoid {
  const group = new THREE.Group();
  const civilian = options.weapon === null;
  const uniform = civilian ? 0xffffff : (options.color ?? 0x303030);
  const hips = [-0.12, 0.12].map(x => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.84, 0);
    inkBox(pivot, [0.18, 0.71, 0.2], [0, -0.355, 0], { color: uniform });
    inkBox(pivot, [0.20, 0.13, 0.30], [0, -0.77, -0.045], { color: 0x191919 });
    group.add(pivot); return pivot;
  });
  const torso = new THREE.Group(); group.add(torso);
  inkBox(torso, [0.45, 0.61, 0.29], [0, 1.125, 0], { color: uniform });
  if (!civilian) {
    inkBox(torso, [0.36, 0.32, 0.09], [0, 1.13, -0.18], { color: 0xeeeeee });
    for (const x of [-0.13, 0, 0.13]) inkBox(torso, [0.09, 0.10, 0.06], [x, 1.01, -0.245]);
  }
  const head = new THREE.Group(); head.position.set(0, 1.60, 0);
  head.add(inkify(new THREE.SphereGeometry(0.15, 8, 5), { color: civilian ? 0xffffff : 0xeeeeee, edgeAngle: 40 }));
  if (!civilian) {
    const helmet = inkify(new THREE.SphereGeometry(0.176, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), { color: 0x303030, edgeAngle: 40 });
    helmet.position.y = 0.015; head.add(helmet);
    inkBox(head, [0.20, 0.04, 0.04], [0, 0.015, -0.14], { color: 0x111111 });
  }
  group.add(head);
  const shoulders = [-0.285, 0.285].map(x => {
    const pivot = new THREE.Group(); pivot.position.set(x, 1.35, 0);
    inkBox(pivot, [0.15, 0.49, 0.15], [0, -0.245, 0], { color: uniform });
    inkBox(pivot, [0.13, 0.11, 0.15], [0, -0.51, 0]);
    pivot.rotation.x = options.armPose === "up" ? -2.65 : options.armPose === "relaxed" ? -0.1 : -1.3;
    group.add(pivot); return pivot;
  });
  let weapon: THREE.Group | null = null;
  if (!civilian) {
    weapon = makeGun(options.weapon ?? "smg", false); weapon.scale.setScalar(0.78);
    weapon.position.set(0.18, 1.15, -0.2); group.add(weapon);
  }
  for (const part of [...hips, ...shoulders, head, torso]) batchInk(part);
  if (weapon) batchInk(weapon);
  return { group, hipL: hips[0], hipR: hips[1], shoulderL: shoulders[0], shoulderR: shoulders[1], head, torso, weapon };
}
export const makeHostage = () => makeHumanoid({ weapon: null, armPose: "up" });

export function makeBike(): THREE.Group {
  const g = new THREE.Group();
  const wheels: THREE.Group[] = [];
  for (const z of [-0.85, 0.85]) {
    const wheel = new THREE.Group(); wheel.position.set(0, 0.42, z);
    const tire = inkify(new THREE.TorusGeometry(0.33, 0.09, 7, 20), { color: 0x191919, edgeAngle: 30 });
    tire.rotation.y = Math.PI / 2; wheel.add(tire);
    const rim = inkify(new THREE.CylinderGeometry(0.245, 0.245, 0.115, 20), { edgeAngle: 40 });
    rim.rotation.z = Math.PI / 2; wheel.add(rim);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
      for (const side of [-0.061, 0.061]) line(wheel, [[side, 0, 0], [side, Math.cos(a) * 0.23, Math.sin(a) * 0.23]]);
    }
    wheels.push(wheel); g.add(wheel);
  }
  const tube = (a: Vec3, b: Vec3, r = 0.025) => beam(g, a, b, r);
  tube([0, 0.42, 0.85], [0, 0.98, 0.17]); tube([0, 0.98, 0.17], [0, 0.43, -0.38]);
  tube([0, 0.43, -0.38], [0, 0.42, 0.85]); tube([0, 1.05, -0.55], [0, 0.97, 0.18]);
  for (const x of [-0.09, 0.09]) tube([x, 1.1, -0.5], [x, 0.42, -0.85], 0.032);
  const tank = inkify(new THREE.CylinderGeometry(0.17, 0.20, 0.56, 6), { edgeAngle: 24 });
  tank.rotation.x = Math.PI / 2; tank.position.set(0, 0.97, -0.23); g.add(tank);
  inkBox(g, [0.32, 0.11, 0.62], [0, 0.98, 0.4], { color: 0x181818 });
  inkBox(g, [0.26, 0.31, 0.28], [0, 0.59, -0.07]);
  for (let i = 0; i < 6; i++) inkBox(g, [0.30, 0.017, 0.31], [0, 0.47 + i * 0.047, -0.07]);
  tube([0.17, 0.45, -0.14], [0.22, 0.43, 0.91], 0.055);
  tube([0, 1.12, -0.54], [-0.47, 1.13, -0.38]); tube([0, 1.12, -0.54], [0.47, 1.13, -0.38]);
  for (const side of [-1, 1]) {
    tube([side * 0.36, 1.13, -0.38], [side * 0.52, 1.13, -0.32], 0.036);
    tube([side * 0.40, 1.13, -0.38], [side * 0.43, 1.39, -0.45], 0.012);
    inkBox(g, [0.16, 0.085, 0.025], [side * 0.43, 1.41, -0.45]);
  }
  const lamp = inkify(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12));
  lamp.rotation.x = Math.PI / 2; lamp.position.set(0, 1.07, -0.69); g.add(lamp);
  wheels.forEach(wheel => wheel.removeFromParent());
  batchInk(g);
  for (const wheel of wheels) { batchInk(wheel); g.add(wheel); }
  g.userData.wheels = wheels;
  return g;
}

/** Camera-space handlebars shown instead of the rifle while riding. */
export function makeBikeCockpit(): THREE.Group {
  const group = new THREE.Group();
  beam(group, [-0.55, 0, 0], [-0.14, -0.08, -0.16], 0.025);
  beam(group, [-0.14, -0.08, -0.16], [0.14, -0.08, -0.16], 0.025);
  beam(group, [0.14, -0.08, -0.16], [0.55, 0, 0], 0.025);
  for (const s of [-1, 1]) {
    beam(group, [s * 0.40, 0, -0.03], [s * 0.62, 0, 0.04], 0.047, 0x191919);
    beam(group, [s * 0.62, -0.35, 0.42], [s * 0.48, -0.05, 0.04], 0.065);
    inkBox(group, [0.115, 0.11, 0.115], [s * 0.48, -0.02, 0.025]);
    beam(group, [s * 0.4, 0, -0.08], [s * 0.48, 0.28, -0.14], 0.013);
    inkBox(group, [0.20, 0.12, 0.024], [s * 0.48, 0.29, -0.15]);
  }
  const gauge = inkify(new THREE.CylinderGeometry(0.115, 0.115, 0.055, 24));
  gauge.rotation.x = Math.PI / 3; gauge.position.set(0, 0.035, -0.19); group.add(gauge);
  const dial = line(group, [[0, 0.06, -0.157], [0.074, 0.09, -0.157]], 0x111111);
  group.userData.dial = dial;
  inkBox(group, [0.38, 0.22, 0.46], [0, -0.29, 0.13]);
  group.position.set(0, -0.28, -0.95);
  batchInk(group);
  return group;
}
export const actorLineMaterial = inkLineMaterial;
