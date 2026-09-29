/** Procedural, proportioned weapon models. One world model also drives the viewmodel. */
import * as THREE from "three";
import { batchInk, beam, inkBox, inkify, line } from "./ink";
import type { Vec3, WeaponKind } from "./types";

function profile(parent: THREE.Object3D, points: [number, number][], thickness: number): THREE.Group {
  const shape = new THREE.Shape();
  points.forEach(([z, y], i) => i ? shape.lineTo(z, y) : shape.moveTo(z, y));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1 });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(thickness / 2, 0, 0);
  const mesh = inkify(geometry);
  parent.add(mesh);
  return mesh;
}

function simpleGun(group: THREE.Group, kind: WeaponKind): void {
  if (kind === "pistol") {
    inkBox(group, [.06, .09, .27], [0, .01, -.13], { color: 0x24282d });
    inkBox(group, [.055, .16, .075], [0, -.1, -.02], { color: 0xb68a58 });
    return;
  }
  const long = kind === "sniper" || kind === "shotgun";
  const body = kind === "smg" ? 0x3f4b54 : kind === "sniper" ? 0x74856d : kind === "shotgun" ? 0x5b6468 : 0x4d5357;
  const furniture = kind === "rifle" ? 0xb47b45 : kind === "shotgun" ? 0xa8774e : kind === "sniper" ? 0x879776 : 0x343b40;
  inkBox(group, [kind === "smg" ? .105 : .09, .13, kind === "smg" ? .4 : .52], [0, 0, -.26], { color: body });
  inkBox(group, [kind === "shotgun" ? .06 : .045, .045, kind === "sniper" ? .84 : long ? .58 : .4], [0, .01, kind === "sniper" ? -.89 : -.66], { color: 0x30363a });
  inkBox(group, [.09, .13, kind === "smg" ? .17 : .30], [0, -.015, kind === "smg" ? .17 : .12], { color: furniture });
  inkBox(group, [.066, kind === "smg" ? .31 : .26, .10], [0, kind === "smg" ? -.18 : -.15, -.24], { color: body });
  if (kind === "sniper") inkBox(group, [.075, .075, .38], [0, .145, -.22], { color: 0x252a2d });
  if (kind === "shotgun") inkBox(group, [.09, .105, .27], [0, -.035, -.62], { color: furniture });
  if (kind === "smg") {
    // Distinct suppressor and wire stock.
    inkBox(group, [.075, .075, .28], [0, .005, -.65], { color: 0x202428 });
    beam(group, [-.055, .04, .02], [-.055, .04, .34], .012, 0x2d3338);
    beam(group, [.055, .04, .02], [.055, .04, .34], .012, 0x2d3338);
  }
}

function pistolModel(group: THREE.Group): number {
  // Compact sidearm: matte-black slide, tan frame, grip, trigger, dot sights.
  inkBox(group, [0.062, 0.078, 0.28], [0, 0.01, -0.1], { color: 0x22272b });
  inkBox(group, [0.054, 0.035, 0.23], [0, -0.038, -0.09], { color: 0x9b7953 });
  const grip = inkBox(group, [0.058, 0.18, 0.09], [0, -0.13, 0.045], { color: 0x9b7953 });
  grip.rotation.x = -0.16;
  line(group, [[0.028, -0.055, -0.03], [0.028, -0.1, -0.045], [0.028, -0.1, -0.1], [0.028, -0.05, -0.11]]);
  inkBox(group, [0.012, 0.02, 0.012], [0, 0.058, -0.21]);
  inkBox(group, [0.04, 0.018, 0.02], [0, 0.055, 0.005]);
  beam(group, [0, 0.01, -0.23], [0, 0.01, -0.27], 0.014);
  return -0.28;
}

export function makeGun(kind: WeaponKind = "rifle", detailed = true): THREE.Group {
  const group = new THREE.Group();
  if (!detailed) {
    simpleGun(group, kind);
    const stub = new THREE.Object3D();
    stub.name = "muzzle";
    group.add(stub);
    return group;
  }
  if (kind === "pistol") {
    const barrelEnd = pistolModel(group);
    const muzzle = new THREE.Object3D();
    muzzle.name = "muzzle"; muzzle.position.set(0, 0.01, barrelEnd - 0.02); group.add(muzzle);
    // Iron sights share one optical axis (y = 0.125) so ADS can look straight
    // through the notch and the front post instead of under the barrel.
    return group;
  }
  const rifle = kind === "rifle", sniper = kind === "sniper", shotgun = kind === "shotgun";
  const barrelEnd = sniper ? -1.52 : rifle ? -1.16 : shotgun ? -1.08 : -0.83;
  const bodyColor = rifle ? 0x4b5155 : kind === "smg" ? 0x3d4951 : sniper ? 0x718269 : 0x596267;
  const furnitureColor = rifle ? 0xb87943 : shotgun ? 0xa5734b : sniper ? 0x879777 : 0x363d42;
  // Receiver, dust cover, charging handle, stock and pistol grip.
  inkBox(group, [kind === "smg" ? 0.115 : 0.10, 0.13, rifle || shotgun ? 0.53 : kind === "smg" ? 0.40 : 0.52], [0, 0, -0.26], { color: bodyColor });
  inkBox(group, [0.092, 0.025, 0.39], [0, 0.077, -0.19]);
  inkBox(group, [0.05, 0.038, 0.078], [0.072, 0.018, -0.24]);
  inkBox(group, [0.108, 0.13, kind === "smg" ? 0.12 : 0.22], [0, -0.018, kind === "smg" ? 0.23 : 0.36], { color: furnitureColor });
  if (kind === "smg") {
    // Twin-rail retractable stock makes the MP5 unmistakably compact.
    beam(group, [-.05, .035, .08], [-.05, .035, .45], .011, 0x343a3f);
    beam(group, [.05, .035, .08], [.05, .035, .45], .011, 0x343a3f);
    inkBox(group, [.14, .13, .06], [0, .035, .47], { color: 0x343a3f });
  } else {
    profile(group, [[0.49, 0.038], [0.14, 0.018], [0.01, -0.05], [0.11, -0.08], [0.44, -0.17], [0.50, -0.14]], 0.085);
    // Colored butt pad/furniture plate differentiates AK, shotgun and SVD.
    inkBox(group, [.095, .14, .24], [0, -.02, .35], { color: furnitureColor });
  }
  const grip = inkBox(group, [0.067, 0.19, 0.11], [0, -0.15, 0.015]);
  grip.rotation.x = -0.22;
  // Trigger guard and trigger, drawn as a real open loop.
  line(group, [[0.052, -0.067, -0.045], [0.052, -0.15, -0.07], [0.052, -0.15, -0.17], [0.052, -0.06, -0.20]]);
  line(group, [[0.052, -0.065, -0.105], [0.052, -0.12, -0.125]]);
  // Separate barrel and gas tube, front ring sight, muzzle brake.
  beam(group, [0, 0, -0.52], [0, 0, barrelEnd], shotgun ? 0.026 : 0.017);
  if (shotgun) {
    // Pump grip + underbarrel tube magazine.
    beam(group, [0, -0.075, -0.5], [0, -0.075, barrelEnd + 0.12], 0.024);
    inkBox(group, [0.095, 0.11, 0.28], [0, -0.045, -0.64], { color: furnitureColor });
    for (let i = 0; i < 4; i++) inkBox(group, [0.09, 0.105, 0.014], [0, -0.045, -0.54 - i * 0.05], { lineColor: 0x555555 });
  } else {
    beam(group, [0, 0.067, -0.49], [0, 0.067, barrelEnd + 0.22], 0.022);
    inkBox(group, [kind === "smg" ? 0.09 : 0.075, kind === "smg" ? 0.1 : 0.09, rifle ? 0.3 : kind === "smg" ? 0.16 : 0.23], [0, -0.007, -0.64], { color: rifle || sniper ? furnitureColor : bodyColor });
    for (let i = 0; i < 5; i++) inkBox(group, [0.08, 0.095, 0.013], [0, -0.007, -0.54 - i * 0.045], { lineColor: 0x555555 });
  }
  beam(group, [0, 0, barrelEnd + 0.06], [0, 0, barrelEnd - 0.035], shotgun ? 0.032 : 0.025);
  // Iron sights share one optical axis (y = 0.125) so ADS can look straight
  // through the notch and the front post instead of under the barrel.
  if (!sniper) {
    const sightY = 0.125;
    inkBox(group, [0.078, 0.018, 0.036], [0, sightY - 0.012, -0.03]);
    inkBox(group, [0.014, 0.05, 0.018], [-0.024, sightY + 0.02, -0.03]);
    inkBox(group, [0.014, 0.05, 0.018], [0.024, sightY + 0.02, -0.03]);
    inkBox(group, [0.009, 0.052, 0.009], [0, sightY + 0.018, barrelEnd + 0.13]);
    const hood = inkify(new THREE.TorusGeometry(0.028, 0.005, 5, 14), { edgeAngle: 32 });
    hood.position.set(0, sightY + 0.018, barrelEnd + 0.13);
    group.add(hood);
  }
  // Curved AK magazine rather than a rectangular placeholder.
  if (rifle) {
    profile(group, [[-0.20, -0.055], [-0.38, -0.055], [-0.38, -0.21], [-0.47, -0.39], [-0.53, -0.45], [-0.37, -0.53], [-0.25, -0.38], [-0.205, -0.20]], 0.071);
    for (const x of [-0.037, 0.037]) {
      for (let i = 0; i < 3; i++) {
        const off = i * 0.035;
        line(group, [[x, -0.1, -0.23 - off], [x, -0.24, -0.25 - off], [x, -0.38, -0.31 - off], [x, -0.45, -0.37 - off]], 0x656565);
      }
    }
  } else if (!shotgun) {
    const mag = inkBox(group, [sniper ? 0.075 : 0.082, sniper ? 0.18 : 0.34, sniper ? 0.13 : 0.095], [0, sniper ? -0.13 : -0.22, -0.25], { color: sniper ? 0x353b3d : 0x3a444b });
    mag.rotation.x = sniper ? -0.08 : 0;
  } else {
    inkBox(group, [0.06, 0.09, 0.16], [0, -0.09, -0.3]);
  }
  if (sniper) {
    // Proper SVD optic: a long body, two mounting rings, ocular hood and a
    // visible glass face. The camera looks down -Z, so cylinders are rotated
    // onto the weapon's barrel axis.
    inkBox(group, [0.045, 0.09, 0.28], [0, 0.12, -0.20]);
    const optic = inkify(new THREE.CylinderGeometry(0.074, 0.082, 0.43, 12), { edgeAngle: 30 });
    optic.rotation.x = Math.PI / 2;
    optic.position.set(0, 0.205, -0.22);
    group.add(optic);
    for (const z of [-0.405, -0.03]) {
      const ring = inkify(new THREE.TorusGeometry(0.09, 0.014, 6, 16), { edgeAngle: 35 });
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.205, z);
      group.add(ring);
    }
    const ocular = inkify(new THREE.CylinderGeometry(0.096, 0.085, 0.11, 12), { edgeAngle: 30 });
    ocular.rotation.x = Math.PI / 2;
    ocular.position.set(0, 0.205, 0.045);
    group.add(ocular);
    const lens = inkify(new THREE.CircleGeometry(0.058, 16), { color: 0xd8d8d8, lineColor: 0x111111, edgeAngle: 30 });
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.205, -0.444);
    group.add(lens);
    // Tiny elevation turret and clamp bolts make the scope read as a real part.
    inkBox(group, [0.075, 0.045, 0.075], [0, 0.292, -0.20]);
    for (const x of [-0.07, 0.07]) inkBox(group, [0.026, 0.025, 0.026], [x, 0.275, -0.405]);
    // Folded bipod under the long barrel completes the marksman silhouette.
    beam(group, [-.035, -.03, -1.05], [-.18, -.26, -1.27], .013, 0x30363a);
    beam(group, [.035, -.03, -1.05], [.18, -.26, -1.27], .013, 0x30363a);
  }
  if (shotgun) {
    // Visible red shell carrier on the receiver's side.
    for (let i = 0; i < 4; i++) inkBox(group, [.025, .025, .10], [.072, .015, -.10 - i * .11], { color: 0xb9362d });
  }
  // Fine mechanical details.
  for (const x of [-0.051, 0.051]) {
    line(group, [[x, 0.018, -0.13], [x, 0.018, -0.36], [x, -0.031, -0.36], [x, -0.031, -0.13], [x, 0.018, -0.13]], 0x555555);
  }
  const muzzle = new THREE.Object3D();
  muzzle.name = "muzzle"; muzzle.position.set(0, 0, barrelEnd - 0.04); group.add(muzzle);
  return group;
}

export function makeViewModel(kind: WeaponKind = "rifle"): { group: THREE.Group; muzzle: THREE.Object3D } {
  const group = makeGun(kind);
  // Two solid white forearms, matching the reference's first-person silhouette.
  const arm = (from: Vec3, to: Vec3, radius: number) => {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
    const mesh = inkify(new THREE.CylinderGeometry(radius * 0.67, radius, start.distanceTo(end), 6), { edgeAngle: 38 });
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    group.add(mesh);
  };
  if (kind === "pistol") {
    arm([0.30, -0.40, 0.42], [0.045, -0.14, 0.05], 0.08);
    inkBox(group, [0.10, 0.12, 0.10], [0.04, -0.12, 0.05]);
  } else {
    arm([-0.37, -0.47, 0.33], [-0.045, -0.087, -0.60], 0.079);
    arm([0.32, -0.40, 0.40], [0.05, -0.16, 0.015], 0.08);
    inkBox(group, [0.10, 0.10, 0.14], [-0.032, -0.08, -0.60]);
    inkBox(group, [0.10, 0.12, 0.10], [0.04, -0.13, 0.018]);
  }
  const muzzle = group.getObjectByName("muzzle")!;
  batchInk(group);
  const flash = new THREE.Group();
  const spikePoints: Vec3[] = [[-.06, 0, -.08], [0, .055, -.13], [.07, 0, -.1], [0, -.05, -.17], [-.06, 0, -.08]];
  line(flash, spikePoints, 0x000000);
  flash.position.copy(muzzle.position); flash.visible = false; group.add(flash);
  group.userData.flash = flash;
  return { group, muzzle };
}
