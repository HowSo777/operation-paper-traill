/** Procedural, proportioned weapon models. One world model also drives the viewmodel. */
import * as THREE from "three";
import { batchInk, beam, inkBox, inkify, line } from "./ink";
import type { Vec3, WeaponKind } from "./types";
import { getEquippedSkin, type WeaponSkin } from "./skins";

function profile(parent: THREE.Object3D, points: [number, number][], thickness: number, skin?: WeaponSkin): THREE.Group {
  const shape = new THREE.Shape();
  points.forEach(([z, y], i) => i ? shape.lineTo(z, y) : shape.moveTo(z, y));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1 });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(thickness / 2, 0, 0);
  const mesh = inkify(geometry, { color: skin?.bodyColor, lineColor: skin?.lineColor });
  parent.add(mesh);
  return mesh;
}

function simpleGun(group: THREE.Group, kind: WeaponKind, skin?: WeaponSkin): void {
  const s = skin ?? getEquippedSkin(kind);
  if (kind === "pistol" || kind === "deagle") {
    inkBox(group, [kind === "deagle" ? .075 : .06, .09, kind === "deagle" ? .34 : .27], [0, .01, -.13], { color: s.bodyColor, lineColor: s.lineColor });
    inkBox(group, [.055, .16, .075], [0, -.1, -.02], { color: s.furnitureColor, lineColor: s.lineColor });
    return;
  }
  const isAwp = kind === "awp";
  const isSniper = kind === "sniper" || isAwp;
  const isSmg = kind === "smg" || kind === "p90";
  const long = isSniper || kind === "shotgun";
  const body = s.bodyColor;
  const furniture = s.furnitureColor;
  const lineCol = s.lineColor;

  inkBox(group, [isSmg ? .105 : .09, .13, isSmg ? .4 : .52], [0, 0, -.26], { color: body, lineColor: lineCol });
  inkBox(group, [kind === "shotgun" ? .06 : .045, .045, isAwp ? .92 : isSniper ? .84 : long ? .58 : .4], [0, .01, isAwp ? -.95 : isSniper ? -.89 : -.66], { color: 0x30363a, lineColor: lineCol });
  inkBox(group, [.09, .13, isSmg ? .17 : .30], [0, -.015, isSmg ? .17 : .12], { color: furniture, lineColor: lineCol });
  inkBox(group, [.066, isSmg ? .31 : .26, .10], [0, isSmg ? -.18 : -.15, -.24], { color: body, lineColor: lineCol });
  if (isSniper) inkBox(group, [.075, .075, .38], [0, .145, -.22], { color: 0x252a2d, lineColor: lineCol });
  if (kind === "shotgun") inkBox(group, [.09, .105, .27], [0, -.035, -.62], { color: furniture, lineColor: lineCol });
  if (kind === "smg") {
    inkBox(group, [.075, .075, .28], [0, .005, -.65], { color: 0x202428, lineColor: lineCol });
    beam(group, [-.055, .04, .02], [-.055, .04, .34], .012, 0x2d3338);
    beam(group, [.055, .04, .02], [.055, .04, .34], .012, 0x2d3338);
  }
}

function pistolModel(group: THREE.Group, skin: WeaponSkin): number {
  inkBox(group, [0.062, 0.078, 0.28], [0, 0.01, -0.1], { color: skin.bodyColor, lineColor: skin.lineColor });
  inkBox(group, [0.054, 0.035, 0.23], [0, -0.038, -0.09], { color: skin.furnitureColor, lineColor: skin.lineColor });
  const grip = inkBox(group, [0.058, 0.18, 0.09], [0, -0.13, 0.045], { color: skin.furnitureColor, lineColor: skin.lineColor });
  grip.rotation.x = -0.16;
  line(group, [[0.028, -0.055, -0.03], [0.028, -0.1, -0.045], [0.028, -0.1, -0.1], [0.028, -0.05, -0.11]], skin.lineColor);
  inkBox(group, [0.012, 0.02, 0.012], [0, 0.058, -0.21], { lineColor: skin.lineColor });
  inkBox(group, [0.04, 0.018, 0.02], [0, 0.055, 0.005], { lineColor: skin.lineColor });
  beam(group, [0, 0.01, -0.23], [0, 0.01, -0.27], 0.014, skin.bodyColor);
  return -0.28;
}

function deagleModel(group: THREE.Group, skin: WeaponSkin): number {
  // Heavy .50 AE hand cannon: massive angular slide, serrations, heavy bore.
  inkBox(group, [0.076, 0.092, 0.35], [0, 0.02, -0.14], { color: skin.bodyColor, lineColor: skin.lineColor });
  inkBox(group, [0.068, 0.04, 0.30], [0, -0.04, -0.13], { color: skin.furnitureColor, lineColor: skin.lineColor });
  const grip = inkBox(group, [0.068, 0.21, 0.11], [0, -0.14, 0.035], { color: skin.furnitureColor, lineColor: skin.lineColor });
  grip.rotation.x = -0.20;
  // Trigger guard and trigger
  line(group, [[0.035, -0.055, -0.04], [0.035, -0.13, -0.05], [0.035, -0.13, -0.14], [0.035, -0.05, -0.15]], skin.lineColor);
  line(group, [[0.035, -0.06, -0.09], [0.035, -0.11, -0.10]], skin.lineColor);
  // Heavy fluted barrel end
  beam(group, [0, 0.02, -0.28], [0, 0.02, -0.36], 0.024, skin.bodyColor);
  // Combat sights
  inkBox(group, [0.016, 0.026, 0.016], [0, 0.076, -0.32], { color: skin.furnitureColor, lineColor: skin.lineColor });
  inkBox(group, [0.044, 0.022, 0.022], [0, 0.072, 0.01], { color: skin.furnitureColor, lineColor: skin.lineColor });
  return -0.36;
}

function p90Model(group: THREE.Group, skin: WeaponSkin): number {
  const barrelEnd = -0.74;
  // Compact futuristic bullpup chassis
  inkBox(group, [0.11, 0.21, 0.58], [0, -0.04, -0.16], { color: skin.bodyColor, lineColor: skin.lineColor });
  inkBox(group, [0.09, 0.18, 0.22], [0, -0.05, 0.16], { color: skin.bodyColor, lineColor: skin.lineColor });
  const foregrip = inkBox(group, [0.08, 0.15, 0.09], [0, -0.13, -0.32], { color: skin.furnitureColor, lineColor: skin.lineColor });
  foregrip.rotation.x = -0.15;
  // Top-mounted horizontal 50-round translucent magazine
  inkBox(group, [0.09, 0.045, 0.44], [0, 0.085, -0.16], { color: skin.furnitureColor, lineColor: skin.lineColor, transparent: true, opacity: 0.85 });
  // Short barrel and flash hider
  beam(group, [0, 0.01, -0.42], [0, 0.01, barrelEnd], 0.018, skin.bodyColor);
  inkBox(group, [0.045, 0.045, 0.06], [0, 0.01, barrelEnd - 0.03], { color: skin.furnitureColor, lineColor: skin.lineColor });
  // Integrated reflex sight bridge
  inkBox(group, [0.05, 0.07, 0.14], [0, 0.14, -0.26], { color: skin.bodyColor, lineColor: skin.lineColor });
  const sight = inkify(new THREE.RingGeometry(0.02, 0.03, 12), { color: 0x38bdf8, lineColor: skin.lineColor });
  sight.position.set(0, 0.14, -0.26);
  group.add(sight);
  return barrelEnd - 0.06;
}

function awpModel(group: THREE.Group, skin: WeaponSkin): number {
  const barrelEnd = -1.78;
  // Heavy polymer body & stock
  inkBox(group, [0.11, 0.14, 0.65], [0, 0, -0.28], { color: skin.bodyColor, lineColor: skin.lineColor });
  inkBox(group, [0.09, 0.15, 0.38], [0, -0.01, 0.28], { color: skin.furnitureColor, lineColor: skin.lineColor });
  inkBox(group, [0.07, 0.06, 0.18], [0, 0.095, 0.22], { color: skin.bodyColor, lineColor: skin.lineColor });
  const grip = inkBox(group, [0.072, 0.20, 0.12], [0, -0.16, 0.02], { color: skin.furnitureColor, lineColor: skin.lineColor });
  grip.rotation.x = -0.25;
  line(group, [[0.055, -0.065, -0.05], [0.055, -0.16, -0.07], [0.055, -0.16, -0.18], [0.055, -0.06, -0.21]], skin.lineColor);
  // Long heavy bull barrel
  beam(group, [0, 0.01, -0.55], [0, 0.01, barrelEnd], 0.024, skin.bodyColor);
  inkBox(group, [0.065, 0.065, 0.12], [0, 0.01, barrelEnd - 0.06], { color: skin.furnitureColor, lineColor: skin.lineColor });
  // Magazine
  inkBox(group, [0.08, 0.22, 0.16], [0, -0.15, -0.26], { color: skin.furnitureColor, lineColor: skin.lineColor });
  // Large precision sniper scope
  inkBox(group, [0.05, 0.10, 0.30], [0, 0.13, -0.22], { color: skin.bodyColor, lineColor: skin.lineColor });
  const optic = inkify(new THREE.CylinderGeometry(0.085, 0.092, 0.52, 14), { color: skin.bodyColor, lineColor: skin.lineColor, edgeAngle: 30 });
  optic.rotation.x = Math.PI / 2;
  optic.position.set(0, 0.22, -0.22);
  group.add(optic);
  for (const z of [-0.42, -0.02]) {
    const ring = inkify(new THREE.TorusGeometry(0.10, 0.016, 6, 16), { color: skin.furnitureColor, lineColor: skin.lineColor, edgeAngle: 35 });
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.22, z);
    group.add(ring);
  }
  const lens = inkify(new THREE.CircleGeometry(0.068, 16), { color: 0x67e8f9, lineColor: skin.lineColor, edgeAngle: 30 });
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0.22, -0.48);
  group.add(lens);
  // Bolt action handle
  beam(group, [0.05, 0.07, -0.06], [0.14, 0.07, -0.06], 0.014, skin.furnitureColor);
  inkBox(group, [0.03, 0.03, 0.03], [0.15, 0.07, -0.06], { color: skin.lineColor, lineColor: skin.lineColor });
  // Bipod
  beam(group, [-0.04, -0.03, -1.15], [-0.19, -0.28, -1.35], 0.014, skin.bodyColor);
  beam(group, [0.04, -0.03, -1.15], [0.19, -0.28, -1.35], 0.014, skin.bodyColor);
  return barrelEnd - 0.1;
}

export function makeGun(kind: WeaponKind = "rifle", detailed = true, skinOverride?: WeaponSkin): THREE.Group {
  const group = new THREE.Group();
  const skin = skinOverride ?? getEquippedSkin(kind);
  if (!detailed) {
    simpleGun(group, kind, skin);
    const stub = new THREE.Object3D();
    stub.name = "muzzle";
    group.add(stub);
    return group;
  }
  if (kind === "pistol") {
    const barrelEnd = pistolModel(group, skin);
    const muzzle = new THREE.Object3D();
    muzzle.name = "muzzle"; muzzle.position.set(0, 0.01, barrelEnd - 0.02); group.add(muzzle);
    return group;
  }
  if (kind === "deagle") {
    const barrelEnd = deagleModel(group, skin);
    const muzzle = new THREE.Object3D();
    muzzle.name = "muzzle"; muzzle.position.set(0, 0.02, barrelEnd - 0.02); group.add(muzzle);
    return group;
  }
  if (kind === "p90") {
    const barrelEnd = p90Model(group, skin);
    const muzzle = new THREE.Object3D();
    muzzle.name = "muzzle"; muzzle.position.set(0, 0.01, barrelEnd - 0.02); group.add(muzzle);
    return group;
  }
  if (kind === "awp") {
    const barrelEnd = awpModel(group, skin);
    const muzzle = new THREE.Object3D();
    muzzle.name = "muzzle"; muzzle.position.set(0, 0.01, barrelEnd - 0.04); group.add(muzzle);
    return group;
  }

  const rifle = kind === "rifle", sniper = kind === "sniper", shotgun = kind === "shotgun";
  const barrelEnd = sniper ? -1.52 : rifle ? -1.16 : shotgun ? -1.08 : -0.83;
  const bodyColor = skin.bodyColor;
  const furnitureColor = skin.furnitureColor;
  const lineCol = skin.lineColor;

  // Receiver, dust cover, charging handle, stock and pistol grip.
  inkBox(group, [kind === "smg" ? 0.115 : 0.10, 0.13, rifle || shotgun ? 0.53 : kind === "smg" ? 0.40 : 0.52], [0, 0, -0.26], { color: bodyColor, lineColor: lineCol });
  inkBox(group, [0.092, 0.025, 0.39], [0, 0.077, -0.19], { lineColor: lineCol });
  inkBox(group, [0.05, 0.038, 0.078], [0.072, 0.018, -0.24], { lineColor: lineCol });
  inkBox(group, [0.108, 0.13, kind === "smg" ? 0.12 : 0.22], [0, -0.018, kind === "smg" ? 0.23 : 0.36], { color: furnitureColor, lineColor: lineCol });
  if (kind === "smg") {
    beam(group, [-.05, .035, .08], [-.05, .035, .45], .011, 0x343a3f);
    beam(group, [.05, .035, .08], [.05, .035, .45], .011, 0x343a3f);
    inkBox(group, [.14, .13, .06], [0, .035, .47], { color: 0x343a3f, lineColor: lineCol });
  } else {
    profile(group, [[0.49, 0.038], [0.14, 0.018], [0.01, -0.05], [0.11, -0.08], [0.44, -0.17], [0.50, -0.14]], 0.085, skin);
    inkBox(group, [.095, .14, .24], [0, -.02, .35], { color: furnitureColor, lineColor: lineCol });
  }
  const grip = inkBox(group, [0.067, 0.19, 0.11], [0, -0.15, 0.015], { lineColor: lineCol });
  grip.rotation.x = -0.22;
  line(group, [[0.052, -0.067, -0.045], [0.052, -0.15, -0.07], [0.052, -0.15, -0.17], [0.052, -0.06, -0.20]], lineCol);
  line(group, [[0.052, -0.065, -0.105], [0.052, -0.12, -0.125]], lineCol);

  beam(group, [0, 0, -0.52], [0, 0, barrelEnd], shotgun ? 0.026 : 0.017, bodyColor);
  if (shotgun) {
    beam(group, [0, -0.075, -0.5], [0, -0.075, barrelEnd + 0.12], 0.024, furnitureColor);
    inkBox(group, [0.095, 0.11, 0.28], [0, -0.045, -0.64], { color: furnitureColor, lineColor: lineCol });
    for (let i = 0; i < 4; i++) inkBox(group, [0.09, 0.105, 0.014], [0, -0.045, -0.54 - i * 0.05], { lineColor: lineCol });
  } else {
    beam(group, [0, 0.067, -0.49], [0, 0.067, barrelEnd + 0.22], 0.022, bodyColor);
    inkBox(group, [kind === "smg" ? 0.09 : 0.075, kind === "smg" ? 0.1 : 0.09, rifle ? 0.3 : kind === "smg" ? 0.16 : 0.23], [0, -0.007, -0.64], { color: rifle || sniper ? furnitureColor : bodyColor, lineColor: lineCol });
    for (let i = 0; i < 5; i++) inkBox(group, [0.08, 0.095, 0.013], [0, -0.007, -0.54 - i * 0.045], { lineColor: lineCol });
  }
  beam(group, [0, 0, barrelEnd + 0.06], [0, 0, barrelEnd - 0.035], shotgun ? 0.032 : 0.025, bodyColor);

  if (!sniper) {
    const sightY = 0.125;
    inkBox(group, [0.078, 0.018, 0.036], [0, sightY - 0.012, -0.03], { lineColor: lineCol });
    inkBox(group, [0.014, 0.05, 0.018], [-0.024, sightY + 0.02, -0.03], { lineColor: lineCol });
    inkBox(group, [0.014, 0.05, 0.018], [0.024, sightY + 0.02, -0.03], { lineColor: lineCol });
    inkBox(group, [0.009, 0.052, 0.009], [0, sightY + 0.018, barrelEnd + 0.13], { lineColor: lineCol });
    const hood = inkify(new THREE.TorusGeometry(0.028, 0.005, 5, 14), { edgeAngle: 32, lineColor: lineCol });
    hood.position.set(0, sightY + 0.018, barrelEnd + 0.13);
    group.add(hood);
  }
  if (rifle) {
    profile(group, [[-0.20, -0.055], [-0.38, -0.055], [-0.38, -0.21], [-0.47, -0.39], [-0.53, -0.45], [-0.37, -0.53], [-0.25, -0.38], [-0.205, -0.20]], 0.071, skin);
    for (const x of [-0.037, 0.037]) {
      for (let i = 0; i < 3; i++) {
        const off = i * 0.035;
        line(group, [[x, -0.1, -0.23 - off], [x, -0.24, -0.25 - off], [x, -0.38, -0.31 - off], [x, -0.45, -0.37 - off]], lineCol);
      }
    }
  } else if (!shotgun) {
    const mag = inkBox(group, [sniper ? 0.075 : 0.082, sniper ? 0.18 : 0.34, sniper ? 0.13 : 0.095], [0, sniper ? -0.13 : -0.22, -0.25], { color: sniper ? 0x353b3d : 0x3a444b, lineColor: lineCol });
    mag.rotation.x = sniper ? -0.08 : 0;
  } else {
    inkBox(group, [0.06, 0.09, 0.16], [0, -0.09, -0.3], { lineColor: lineCol });
  }
  if (sniper) {
    inkBox(group, [0.045, 0.09, 0.28], [0, 0.12, -0.20], { lineColor: lineCol });
    const optic = inkify(new THREE.CylinderGeometry(0.074, 0.082, 0.43, 12), { edgeAngle: 30, lineColor: lineCol });
    optic.rotation.x = Math.PI / 2;
    optic.position.set(0, 0.205, -0.22);
    group.add(optic);
    for (const z of [-0.405, -0.03]) {
      const ring = inkify(new THREE.TorusGeometry(0.09, 0.014, 6, 16), { edgeAngle: 35, lineColor: lineCol });
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.205, z);
      group.add(ring);
    }
    const ocular = inkify(new THREE.CylinderGeometry(0.096, 0.085, 0.11, 12), { edgeAngle: 30, lineColor: lineCol });
    ocular.rotation.x = Math.PI / 2;
    ocular.position.set(0, 0.205, 0.045);
    group.add(ocular);
    const lens = inkify(new THREE.CircleGeometry(0.058, 16), { color: 0xd8d8d8, lineColor: lineCol, edgeAngle: 30 });
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.205, -0.444);
    group.add(lens);
    inkBox(group, [0.075, 0.045, 0.075], [0, 0.292, -0.20], { lineColor: lineCol });
    for (const x of [-0.07, 0.07]) inkBox(group, [0.026, 0.025, 0.026], [x, 0.275, -0.405], { lineColor: lineCol });
    beam(group, [-.035, -.03, -1.05], [-.18, -.26, -1.27], .013, 0x30363a);
    beam(group, [.035, -.03, -1.05], [.18, -.26, -1.27], .013, 0x30363a);
  }
  if (shotgun) {
    for (let i = 0; i < 4; i++) inkBox(group, [.025, .025, .10], [.072, .015, -.10 - i * .11], { color: 0xb9362d, lineColor: lineCol });
  }
  for (const x of [-0.051, 0.051]) {
    line(group, [[x, 0.018, -0.13], [x, 0.018, -0.36], [x, -0.031, -0.36], [x, -0.031, -0.13], [x, 0.018, -0.13]], lineCol);
  }
  const muzzle = new THREE.Object3D();
  muzzle.name = "muzzle"; muzzle.position.set(0, 0, barrelEnd - 0.04); group.add(muzzle);
  return group;
}

export function makeViewModel(kind: WeaponKind = "rifle", skinOverride?: WeaponSkin): { group: THREE.Group; muzzle: THREE.Object3D } {
  const group = makeGun(kind, true, skinOverride);
  const skin = skinOverride ?? getEquippedSkin(kind);
  // Two solid forearms, matching the first-person silhouette.
  const arm = (from: Vec3, to: Vec3, radius: number) => {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
    const mesh = inkify(new THREE.CylinderGeometry(radius * 0.67, radius, start.distanceTo(end), 6), { edgeAngle: 38, lineColor: skin.lineColor });
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    group.add(mesh);
  };
  if (kind === "pistol" || kind === "deagle") {
    arm([0.30, -0.40, 0.42], [0.045, -0.14, 0.05], 0.08);
    inkBox(group, [0.10, 0.12, 0.10], [0.04, -0.12, 0.05], { lineColor: skin.lineColor });
  } else {
    arm([-0.37, -0.47, 0.33], [-0.045, -0.087, -0.60], 0.079);
    arm([0.32, -0.40, 0.40], [0.05, -0.16, 0.015], 0.08);
    inkBox(group, [0.10, 0.10, 0.14], [-0.032, -0.08, -0.60], { lineColor: skin.lineColor });
    inkBox(group, [0.10, 0.12, 0.10], [0.04, -0.13, 0.018], { lineColor: skin.lineColor });
  }
  const muzzle = group.getObjectByName("muzzle")!;
  batchInk(group);
  const flash = new THREE.Group();
  const spikePoints: Vec3[] = [[-.06, 0, -.08], [0, .055, -.13], [.07, 0, -.1], [0, -.05, -.17], [-.06, 0, -.08]];
  line(flash, spikePoints, skin.lineColor ?? 0x000000);
  flash.position.copy(muzzle.position); flash.visible = false; group.add(flash);
  group.userData.flash = flash;
  return { group, muzzle };
}
