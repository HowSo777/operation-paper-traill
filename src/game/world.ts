/** Procedural industrial compound: ink outlines over a warm, color-coded paper world. */
import * as THREE from "three";
import { batchInk, beam, disposeObject, inkBox, inkify, inkLineMaterial, inkMesh, label, line, mergeBoxes } from "./ink";
import { BIKE, BUNKER, BUNKER_CONCRETE, BUNKER_EARTH, BUILDINGS, CATWALK_BOXES, CHECKPOINTS, COVER, CRATES, EXTRA_LADDERS, FENCE_PANELS, HOSTAGE, LADDERS, PEN_PANELS, ROAD_HALF_WIDTH, ROAD_OBSTACLES, ROAD_POINTS, ROAD_RAILS, TANKS, TEAM_COLORS, TEAM_SPAWNS, TOWERS, TOWER_BOXES, WORLD, type BuildingDef, type FencePanelDef } from "./mapData";
import { makeBike } from "./actors";
import type { Vec3 } from "./types";

export type World = {
  root: THREE.Group; bike: THREE.Group; bikePosition: Vec3; hostagePosition: Vec3;
  ladders: typeof LADDERS; checkpoints: THREE.Group[];
  update: (dt: number, elapsed: number, nextCheckpoint: number) => void;
  dispose: () => void;
};

const BUILDING_COLORS = [0xdce9ed, 0xe9ddc8, 0xdce9d9, 0xe7cdb4, 0xd9e1eb, 0xe8d0ad, 0xd8d7c9, 0xd8e6eb, 0xd9e5d8, 0xe6d7c1, 0xd8e2e8, 0xe6d6b9];
const CONTAINER_COLORS = [0x75b9bd, 0xd98a54, 0xa1b477, 0x6f96b7, 0xe0b849];
const TANK_COLOR = 0xd4e3e8;
const GATE_DONE = 0x2a9d48;
const GATE_NEXT = 0xe8a020;
const GATE_TODO = 0x9a9a9a;

function drawFence(panels: FencePanelDef[], root: THREE.Object3D) {
  for (const p of panels) {
    const group = new THREE.Group();
    group.position.set(p.pos[0], 0, p.pos[2]); group.rotation.y = p.yaw;
    const w = p.width, h = p.height;
    const parts: { pos: Vec3; size: Vec3 }[] = [];
    const posts = Math.ceil(w / 4.3);
    for (let i = 0; i <= posts; i++) {
      const x = -w / 2 + i * w / posts;
      parts.push({ pos: [x, (h + 0.24) / 2, 0], size: [0.12, h + 0.24, 0.12] });
      parts.push({ pos: [x, 0.06, 0], size: [0.36, 0.12, 0.33] });
    }
    for (const y of [0.12, h - 0.02]) parts.push({ pos: [0, y, 0], size: [w, 0.047, 0.047] });
    group.add(inkify(mergeBoxes(parts)));
    // Actual clipped line segments: large, crisp diamonds, no moiré texture.
    const vertices: number[] = [];
    for (const direction of [-1, 1]) {
      for (let start = -w / 2 - h; start <= w / 2 + h; start += 0.75) {
        let lo = 0.16, hi = h - 0.09;
        if (direction > 0) { lo = Math.max(lo, -w / 2 - start); hi = Math.min(hi, w / 2 - start); }
        else { lo = Math.max(lo, start - w / 2); hi = Math.min(hi, start + w / 2); }
        if (hi > lo) vertices.push(start + direction * lo, lo, 0, start + direction * hi, hi, 0);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    group.add(new THREE.LineSegments(geometry, inkLineMaterial(0x929292)));
    root.add(group);
  }
}

function windowFrame(root: THREE.Object3D, pos: Vec3, yaw = 0) {
  const group = new THREE.Group(); group.position.set(...pos); group.rotation.y = yaw;
  const w = 1.45, h = 1.18;
  inkBox(group, [w + 0.16, 0.055, 0.1], [0, h / 2 + 0.03, 0]);
  inkBox(group, [w + 0.2, 0.055, 0.14], [0, -h / 2, 0]);
  for (const x of [-w / 2, 0, w / 2]) inkBox(group, [0.055, h, 0.07], [x, 0, 0]);
  for (let i = 0; i < 3; i++) line(group, [[0.40 + i * .09, -.45, .006], [.12 + i * .09, -.12, .006]], 0x888888);
  root.add(group);
}

function building(root: THREE.Object3D, b: BuildingDef, index: number) {
  const [x, y, z] = b.pos, [w, h, d] = b.size;
  const fill = BUILDING_COLORS[index % BUILDING_COLORS.length];
  inkBox(root, b.size, b.pos, { color: fill });
  inkBox(root, [w + 0.4, 0.16, d + 0.4], [x, h + 0.08, z]);
  inkBox(root, [w + 0.5, 0.07, d + 0.5], [x, h - 0.26, z]);
  // Foundation seam sits at ground level, not floating above the building.
  line(root, [[x - w / 2 - .01, .12, z + d / 2 + .012], [x + w / 2 + .01, .12, z + d / 2 + .012], [x + w / 2 + .012, .12, z - d / 2 - .01]], 0x555555);
  if (b.windows) {
    for (let dz = -d / 2 + 3; dz < d / 2 - 1; dz += 6) windowFrame(root, [x + w / 2 + .025, 2.6, z + dz], Math.PI / 2);
    for (let dx = -w / 2 + 3; dx < w / 2 - 1; dx += 6) windowFrame(root, [x + dx, 2.6, z + d / 2 + .025]);
  }
  const doorX = x - w * 0.18, front = z + d / 2 + .02;
  line(root, [[doorX - 1.5, .02, front], [doorX - 1.5, 3.2, front], [doorX + 1.5, 3.2, front], [doorX + 1.5, .02, front]]);
  for (let dy = .35; dy < 3.1; dy += .27) line(root, [[doorX - 1.45, dy, front], [doorX + 1.45, dy, front]], 0x969696);
  label(root, b.label, 4.3, [x, h - .8, front + .01]);
  // Roof ventilation pipes.
  inkBox(root, [1.2, .8, 1.3], [x + w * .25, h + .4, z]);
  beam(root, [x - w * .2, h, z - 1], [x - w * .2, h + 1.3, z - 1], .14);
}

function towers(root: THREE.Object3D) {
  root.add(inkify(mergeBoxes(TOWER_BOXES.map(b => ({ pos: b.pos, size: b.size })))));
  for (const t of TOWERS) {
    const [x, , z] = t.pos, h = t.platformHeight;
    for (const side of [-2, 2]) {
      beam(root, [x - 2, .3, z + side], [x + 2, h - .3, z + side], .045);
      beam(root, [x + 2, .3, z + side], [x - 2, h - .3, z + side], .045);
      beam(root, [x + side, .3, z - 2], [x + side, h - .3, z + 2], .045);
      for (const dz of [-2.2, 2.2]) beam(root, [x + side, h, z + dz], [x + side, h + 2.7, z + dz], .042);
    }
    for (const y of [h + .5, h + 1]) {
      for (const side of [-2.3, 2.3]) beam(root, [x + side, y, z - 2.3], [x + side, y, z + 2.3], .025);
      beam(root, [x - 2.3, y, z - 2.3], [x + 2.3, y, z - 2.3], .025);
    }
    const rungs: { pos: Vec3; size: Vec3 }[] = [];
    for (const dx of [-.34, .34]) rungs.push({ pos: [x + dx, h / 2 + .3, z + 2.95], size: [.055, h + .6, .055] });
    for (let y = .24; y <= h + .35; y += .35) rungs.push({ pos: [x, y, z + 2.95], size: [.7, .045, .045] });
    root.add(inkify(mergeBoxes(rungs)));
    beam(root, [x, h + 2.8, z], [x, h + 5.7, z], .025);
    line(root, [[x - .85, h + 4.8, z], [x + .85, h + 4.8, z]]);
  }
}

function tanks(root: THREE.Object3D) {
  for (let index = 0; index < TANKS.length; index++) {
    const t = TANKS[index], [x, , z] = t.pos;
    const shell = inkify(new THREE.CylinderGeometry(t.radius, t.radius, t.height, 48), { edgeAngle: 30, silhouette: true, color: TANK_COLOR });
    shell.position.set(x, t.height / 2, z); root.add(shell);
    for (const y of [.12, t.height * .34, t.height * .7, t.height]) {
      const points: Vec3[] = [];
      for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; points.push([x + Math.cos(a) * (t.radius + .016), y, z + Math.sin(a) * (t.radius + .016)]); }
      line(root, points, 0x8a6a4a);
    }
    const rim = inkify(new THREE.CylinderGeometry(t.radius + .1, t.radius + .1, .14, 48), { edgeAngle: 35 });
    rim.position.set(x, t.height + .03, z); root.add(rim);
    beam(root, [x, t.height, z], [x, t.height + .6, z], .065);
    for (const dx of [-.27, .27]) beam(root, [x + dx, .1, z + t.radius + .12], [x + dx, t.height + .25, z + t.radius + .12], .028);
    for (let y = .3; y < t.height + .25; y += .4) beam(root, [x - .28, y, z + t.radius + .12], [x + .28, y, z + t.radius + .12], .022);
    label(root, `T-${String(index + 1).padStart(2, "0")}`, 3.3, [x, t.height * .64, z + t.radius + .026]);
  }
  // Elevated pipe bridge gives the skyline its industrial character.
  beam(root, [31, 3, -4], [63, 3, -4], .16, 0xc9a06a);
  beam(root, [31, 3, -6], [63, 3, -6], .095, 0x9fc6c9);
  for (const x of [31, 42, 53, 63]) {
    inkBox(root, [.16, 3, .16], [x, 1.5, -4]);
    inkBox(root, [.16, 3, .16], [x, 1.5, -6]);
    beam(root, [x, 3.3, -6.5], [x, 3.3, -3.5], .04);
  }
}

function crate(root: THREE.Object3D, pos: Vec3, size: Vec3, container = false) {
  if (!container) {
    inkBox(root, size, pos, { color: 0xf1e6d0 });
    return;
  }
  const hash = Math.abs(Math.floor(pos[0] * 7 + pos[2] * 13)) % CONTAINER_COLORS.length;
  inkBox(root, size, pos, { color: CONTAINER_COLORS[hash] });
  const [x, y, z] = pos, [w, h, d] = size;
  for (let dx = -w / 2 + .22; dx < w / 2; dx += .43) {
    for (const side of [-1, 1]) line(root, [[x + dx, y - h / 2 + .06, z + side * (d / 2 + .012)], [x + dx, y + h / 2 - .06, z + side * (d / 2 + .012)]], 0x4a4a4a);
  }
  for (let dz = -d / 2 + .22; dz < d / 2; dz += .43) for (const side of [-1, 1]) line(root, [[x + side * (w / 2 + .012), y - h / 2 + .06, z + dz], [x + side * (w / 2 + .012), y + h / 2 - .06, z + dz]], 0x4a4a4a);
}

function roadNormal(index: number): [number, number] {
  const prev = ROAD_POINTS[Math.max(0, index - 1)];
  const next = ROAD_POINTS[Math.min(ROAD_POINTS.length - 1, index + 1)];
  const dx = next[0] - prev[0], dz = next[2] - prev[2];
  const length = Math.hypot(dx, dz) || 1;
  return [-dz / length, dx / length];
}

function roadHeading(point: Vec3): number {
  let best = 0, bestDistance = Infinity;
  for (let i = 1; i < ROAD_POINTS.length; i++) {
    const a = ROAD_POINTS[i - 1], b = ROAD_POINTS[i];
    const mx = (a[0] + b[0]) / 2, mz = (a[2] + b[2]) / 2;
    const d = Math.hypot(point[0] - mx, point[2] - mz);
    if (d < bestDistance) { bestDistance = d; best = i; }
  }
  const a = ROAD_POINTS[best - 1], b = ROAD_POINTS[best];
  return Math.atan2(b[0] - a[0], b[2] - a[2]);
}

function skyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4; canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#5d94c9");
  gradient.addColorStop(0.42, "#a8c8e4");
  gradient.addColorStop(0.62, "#e9ecdf");
  gradient.addColorStop(0.72, "#faf7ef");
  gradient.addColorStop(1, "#ffffff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roads(root: THREE.Object3D): THREE.Group[] {
  // Continuous ribbon: mitered edges so corners actually meet.
  const left: Vec3[] = [];
  const right: Vec3[] = [];
  const railL: Vec3[] = [];
  const railR: Vec3[] = [];
  for (let i = 0; i < ROAD_POINTS.length; i++) {
    const [nx, nz] = roadNormal(i);
    const p = ROAD_POINTS[i];
    left.push([p[0] + nx * ROAD_HALF_WIDTH, 0.02, p[2] + nz * ROAD_HALF_WIDTH]);
    right.push([p[0] - nx * ROAD_HALF_WIDTH, 0.02, p[2] - nz * ROAD_HALF_WIDTH]);
    railL.push([p[0] + nx * 8.8, 0.95, p[2] + nz * 8.8]);
    railR.push([p[0] - nx * 8.8, 0.95, p[2] - nz * 8.8]);
  }
  // Asphalt ribbon mesh under the line work so the road reads from far away.
  const ribbon: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < left.length; i++) {
    ribbon.push(left[i][0], 0.012, left[i][2], right[i][0], 0.012, right[i][2]);
    if (i > 0) {
      const b = (i - 1) * 2;
      indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const ribbonGeo = new THREE.BufferGeometry();
  ribbonGeo.setAttribute("position", new THREE.Float32BufferAttribute(ribbon, 3));
  ribbonGeo.setIndex(indices);
  const ribbonMesh = new THREE.Mesh(ribbonGeo, new THREE.MeshBasicMaterial({ color: 0xd9d2c2, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  root.add(ribbonMesh);
  line(root, left, 0x5a5a5a);
  line(root, right, 0x5a5a5a);
  line(root, railL, 0x757575);
  line(root, railR, 0x757575);
  for (let i = 1; i < ROAD_POINTS.length; i++) {
    const a = ROAD_POINTS[i - 1], b = ROAD_POINTS[i];
    const dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
    for (let d = 2; d < length; d += 7) {
      const end = Math.min(d + 2.4, length);
      line(root, [
        [a[0] + dx * d / length, 0.021, a[2] + dz * d / length],
        [a[0] + dx * end / length, 0.021, a[2] + dz * end / length],
      ], 0xffffff);
    }
  }
  root.add(inkify(mergeBoxes(ROAD_RAILS.map(b => ({ pos: b.pos, size: b.size })))));
  for (const b of ROAD_OBSTACLES) crate(root, b.pos, b.size);

  const finish = CHECKPOINTS[CHECKPOINTS.length - 1];
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 3.85, 48),
    new THREE.MeshBasicMaterial({ color: 0x1f8a3d, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(finish[0], 0.03, finish[2]);
  root.add(ring);
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(3.3, 40),
    new THREE.MeshBasicMaterial({ color: 0x2a9d48, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(finish[0], 0.028, finish[2]);
  root.add(pad);
  label(root, "EXTRACTION", 5.4, [finish[0], 0.04, finish[2] + 5.2]);

  const checkpoints = CHECKPOINTS.map((point, i) => {
    const gate = new THREE.Group();
    gate.position.set(...point);
    gate.rotation.y = roadHeading(point);
    const last = i === CHECKPOINTS.length - 1;
    for (const side of [-1, 1]) {
      inkBox(gate, [.16, last ? 5.1 : 4.3, .16], [side * 6.3, last ? 2.55 : 2.15, 0]);
      inkBox(gate, [.6, .17, .6], [side * 6.3, .085, 0]);
    }
    inkBox(gate, [12.76, .09, .09], [0, last ? 5.1 : 4.3, 0]);
    const sign = label(gate, last ? "EXTRACTION / FINISH" : `SERVICE ROAD / ${String(i + 1).padStart(2, "0")}`, last ? 5.6 : 5, [0, last ? 4.72 : 3.92, -.07]);
    sign.rotation.y = Math.PI;
    line(gate, [[-6.3, .023, 0], [6.3, .023, 0]]);
    root.add(gate);
    return gate;
  });
  for (let i = 0; i < 15; i++) {
    const side = i % 2 ? 1 : -1, x = side * (35 + (i * 7) % 23), z = 85 + i * 11;
    const rock = inkify(new THREE.DodecahedronGeometry(2 + (i % 3), 0), { edgeAngle: 22, color: 0xe4e0d4 });
    rock.scale.y = .6; rock.position.set(x, 1, z); rock.rotation.y = i; root.add(rock);
  }
  return checkpoints;
}

/** Perimeter chain-link: visible edge of the map (movement stops, bullets don't). */
function boundaryPanels(): FencePanelDef[] {
  const h = 5;
  const panels: FencePanelDef[] = [];
  const seg = 24;
  for (let x = -WORLD.outer; x < WORLD.outer - 0.1; x += seg) {
    const w = Math.min(seg, WORLD.outer - x);
    panels.push({ pos: [x + w / 2, h / 2, WORLD.north + 0.5], yaw: 0, width: w, height: h });
    panels.push({ pos: [x + w / 2, h / 2, WORLD.south - 0.5], yaw: 0, width: w, height: h });
  }
  for (let z = WORLD.north; z < WORLD.south - 0.1; z += seg) {
    const w = Math.min(seg, WORLD.south - z);
    panels.push({ pos: [-WORLD.outer + 0.5, h / 2, z + w / 2], yaw: Math.PI / 2, width: w, height: h });
    panels.push({ pos: [WORLD.outer - 0.5, h / 2, z + w / 2], yaw: Math.PI / 2, width: w, height: h });
  }
  return panels;
}

/** Buried concrete shelter: earth berm, blast-door corridor, hostage inside. */
function bunker(root: THREE.Object3D): void {
  for (const b of BUNKER_CONCRETE) inkBox(root, b.size, b.pos, { color: 0xdad6ca });
  for (const b of BUNKER_EARTH) inkBox(root, b.size, b.pos, { color: 0xc9b691 });
  // Heap silhouettes soften the buried roof into a mound.
  for (const [x, y, z, r] of [[-61, 4.4, -32.5, 3.4], [-55.2, 4.3, -28.2, 2.7], [-58.4, 5.1, -30.4, 2.3]] as const) {
    const mound = inkify(new THREE.DodecahedronGeometry(r, 0), { color: 0xc9b691, edgeAngle: 20 });
    mound.position.set(x, y, z); mound.scale.y = 0.55; mound.rotation.y = x * 0.3; root.add(mound);
  }
  // Blast door, cracked open at the mouth of the corridor.
  for (const side of [-1, 1]) {
    const door = inkBox(root, [1.45, 2.7, 0.14], [BUNKER.door[0] + side * 1.9, 1.35, BUNKER.door[2] + 0.35], { color: 0xb4aea0 });
    door.rotation.y = side * 0.9;
  }
  // Sandbags stacked either side of the entrance.
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 3 - (row > 1 ? 1 : 0); i++) {
        inkBox(root, [0.6, 0.3, 0.38], [BUNKER.door[0] + side * (2.6 + row * 0.1), 0.17 + row * 0.3, BUNKER.door[2] + 0.6 - i * 0.42], { color: 0xd6cdb4 });
      }
    }
  }
  label(root, "SHELTER 07", 3.4, [BUNKER.door[0], 2.5, BUNKER.door[2] + 0.12]);
  // Strip lamp inside so the room reads from the doorway.
  inkBox(root, [1.5, 0.08, 0.18], [BUNKER.interior[0], 3.0, BUNKER.interior[2]]);
  line(root, [[BUNKER.interior[0], 3.0, BUNKER.interior[2] - 0.06], [BUNKER.interior[0], 3.16, BUNKER.interior[2] - 0.06]], 0x555555);
  // The obvious pen out front is a decoy: it is empty.
  label(root, "HOLDING PEN / EMPTY", 3.2, [8, 1.5, -29.4]);
}

/** Climbable ladder drawn as rails + rungs, in the watchtower style. */
function drawLadder(root: THREE.Object3D, ladder: { pos: Vec3; yMax: number }): void {
  const rungs: { pos: Vec3; size: Vec3 }[] = [];
  for (const dx of [-0.34, 0.34]) rungs.push({ pos: [ladder.pos[0] + dx, ladder.yMax / 2 + 0.3, ladder.pos[2]], size: [0.055, ladder.yMax + 0.6, 0.055] });
  for (let y = 0.24; y <= ladder.yMax + 0.35; y += 0.35) rungs.push({ pos: [ladder.pos[0], y, ladder.pos[2]], size: [0.7, 0.045, 0.045] });
  root.add(inkify(mergeBoxes(rungs)));
}

/** Rail spur: sleepers, twin rails, a flatcar you can jump onto and a tanker. */
function railYard(root: THREE.Object3D): void {
  for (const rx of [65.28, 66.72]) beam(root, [rx, 0.16, -49], [rx, 0.16, -25], 0.05, 0x7a7a7a);
  for (let z = -48.5; z <= -25.5; z += 0.85) inkBox(root, [2.7, 0.12, 0.34], [66, 0.06, z], { color: 0xa08b6a });
  line(root, [[66, 0.03, -50], [66, 0.03, -24]], 0x8a8a8a);
  // Flatcar: deck top lands at 1.05m, jumpable onto.
  inkBox(root, [2.6, 0.5, 8], [66, 0.8, -34], { color: 0x9aa7b0 });
  inkBox(root, [1.6, 0.35, 7], [66, 0.35, -34], { color: 0x555555 });
  for (const z of [-36.6, -34, -31.4]) for (const x of [-1.1, 1.1]) {
    const wheel = inkify(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12), { edgeAngle: 35 });
    wheel.rotation.z = Math.PI / 2; wheel.position.set(66 + x, 0.3, z); root.add(wheel);
  }
  // Tanker wagon: tall opaque cover, its box matches the drawn shell.
  const tank = inkify(new THREE.CylinderGeometry(1.7, 1.7, 6.4, 28), { edgeAngle: 30, color: 0xdfe9ef, silhouette: true });
  tank.rotation.x = Math.PI / 2; tank.position.set(76, 1.9, -30); root.add(tank);
  inkBox(root, [1.4, 0.4, 6], [76, 0.3, -30], { color: 0x555555 });
  for (const z of [-32.2, -30, -27.8]) for (const x of [-1.2, 1.2]) {
    const wheel = inkify(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12), { edgeAngle: 35 });
    wheel.rotation.z = Math.PI / 2; wheel.position.set(76 + x, 0.3, z); root.add(wheel);
  }
  // Brake van closes the sightline at the far end.
  inkBox(root, [3, 2.8, 5], [66, 1.4, -44], { color: 0xb8a48a });
  inkBox(root, [3.3, 0.16, 5.3], [66, 2.86, -44], { color: 0x7d6f5c });
  for (const x of [-1.52, 1.52]) for (const z of [-45.6, -42.4]) inkBox(root, [0.06, 0.8, 1.1], [x, 1.7, z]);
  label(root, "YARD 4 / RAIL SPUR", 4.4, [66, 2.45, -41.44]);
  label(root, "FLATCAR 88", 2.4, [66.01, 1.1, -30.6]);
}

/** Elevated catwalk over the south yard, connecting onto the maintenance roof. */
function catwalk(root: THREE.Object3D): void {
  inkBox(root, [20, 0.25, 3], [6, 5.075, 26], { color: 0xd9d4c4 });
  inkBox(root, [4, 0.25, 4], [16, 5.075, 22.5], { color: 0xd9d4c4 });
  // Deck grating.
  for (let x = -3.5; x <= 15.5; x += 1.6) line(root, [[x, 5.19, 24.62], [x, 5.19, 27.38]], 0x9a9a9a);
  for (let z = 20.7; z <= 24.3; z += 1.4) line(root, [[14.15, 5.19, z], [17.85, 5.19, z]], 0x9a9a9a);
  // Deck structure, railings and legs (everything except the platforms).
  root.add(inkify(mergeBoxes(CATWALK_BOXES.filter(b => b.kind !== "platform").map(b => ({ pos: b.pos, size: b.size })))));
  label(root, "ELEVATED WALKWAY", 3.4, [6, 5.85, 24.52]);
  for (const ladder of EXTRA_LADDERS) drawLadder(root, ladder);
  label(root, "ROOF ACCESS", 2.6, [-26, 6.4, 7.7]);
}

/** Two wrecked vehicles as recognisable hard cover. */
function wrecks(root: THREE.Object3D): void {
  // Sedan on its side.
  const car = new THREE.Group(); car.position.set(-14, 0, 30);
  inkBox(car, [4.4, 1.4, 1.9], [0, 0.7, 0], { color: 0xd7d0bf });
  inkBox(car, [1.9, 0.7, 1.7], [0.35, 1.4, 0.25], { color: 0xc9c2b0 });
  for (const z of [-1.4, 1.4]) {
    const wheel = inkify(new THREE.CylinderGeometry(0.32, 0.32, 0.14, 12), { edgeAngle: 35, color: 0x222222 });
    wheel.position.set(0, 1.44, z); car.add(wheel);
  }
  line(car, [[2.21, 0.15, -0.8], [2.21, 1.2, -0.8]], 0x555555);
  root.add(car);
  // Box truck standing upright.
  const truck = new THREE.Group(); truck.position.set(40, 0, 44);
  inkBox(truck, [2.4, 2.2, 6.4], [0, 1.1, 0], { color: 0xdad3c2 });
  inkBox(truck, [2.2, 1.3, 1.7], [0, 1.35, -3.7], { color: 0xbdb6a4 });
  inkBox(truck, [2.5, 0.14, 6.6], [0, 2.24, 0], { color: 0x8d8778 });
  for (const z of [-2.4, 2.5]) for (const x of [-1.15, 1.15]) {
    const wheel = inkify(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 12), { edgeAngle: 35, color: 0x222222 });
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.42, z); truck.add(wheel);
  }
  const side = label(truck, "COURIER 04", 2.2, [1.22, 1.5, 0.6]);
  side.rotation.y = Math.PI / 2;
  root.add(truck);
}

export function buildWorld(scene: THREE.Scene): World {
  const root = new THREE.Group(); scene.add(root);
  scene.background = new THREE.Color(0xf6f3ec);
  scene.fog = new THREE.Fog(0xf1ede2, 150, 520);

  // Sky dome with a warm-to-blue gradient, plus a pale sun.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(760, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.DoubleSide, fog: false, depthWrite: false }),
  );
  sky.position.set(0, 0, 120);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  root.add(sky);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(26, 32), new THREE.MeshBasicMaterial({ color: 0xfdf3d8, fog: false, side: THREE.DoubleSide }));
  sun.position.set(-260, 190, -320);
  sun.lookAt(0, 0, 120);
  root.add(sun);
  const sunRing = new THREE.Mesh(new THREE.RingGeometry(30, 33, 40), new THREE.MeshBasicMaterial({ color: 0xe8d9ae, fog: false, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }));
  sunRing.position.copy(sun.position);
  sunRing.lookAt(0, 0, 120);
  root.add(sunRing);

  // Distant mountain silhouettes for depth.
  for (const [mx, mz, w, h, c] of [[-320, -420, 420, 120, 0xd9e2ea], [260, -460, 520, 150, 0xcfdae4], [420, 120, 380, 100, 0xe2ddcf]] as const) {
    const ridge = new THREE.Mesh(
      new THREE.ConeGeometry(w / 2, h, 5, 1),
      new THREE.MeshBasicMaterial({ color: c, fog: false }),
    );
    ridge.position.set(mx, h / 2 - 4, mz);
    ridge.scale.z = 0.35;
    root.add(ridge);
    const ridgeEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(ridge.geometry, 20),
      inkLineMaterial(0x8a94a0),
    );
    ridgeEdge.position.copy(ridge.position);
    ridgeEdge.scale.copy(ridge.scale);
    root.add(ridgeEdge);
  }

  const ground = inkMesh(new THREE.PlaneGeometry(WORLD.groundSize, WORLD.groundSize));
  ground.rotation.x = -Math.PI / 2; ground.position.z = 90; root.add(ground);

  // Safe-zone tint so staging reads as friendly territory.
  const safe = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 31),
    new THREE.MeshBasicMaterial({ color: 0x2a9d48, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }),
  );
  safe.rotation.x = -Math.PI / 2;
  safe.position.set(0, 0.015, 66.5);
  root.add(safe);

  BUILDINGS.forEach((b, i) => building(root, b, i));
  towers(root); tanks(root); drawFence(FENCE_PANELS, root); drawFence(PEN_PANELS, root);
  drawFence(boundaryPanels(), root);
  bunker(root);
  railYard(root); catwalk(root); wrecks(root);
  CRATES.forEach(b => crate(root, b.pos, b.size, b.kind === "container"));
  COVER.forEach(b => inkBox(root, b.size, b.pos, { color: 0xe8e2d2 }));
  // Plain paved lanes with curbs instead of a dense blueprint grid.
  for (const x of [-4.25, -3.95, 7.8, 8.1]) line(root, [[x, .025, 50], [x, .025, 27], [x + 1.6, .025, 21]], 0x5c5c5c);
  for (const z of [6, 6.24]) line(root, [[-47, .02, z], [-13, .02, z]], 0x777777);
  for (const [x, z] of [[8, 36], [-9, 12], [15, -8], [-41, -29]] as [number, number][]) {
    inkBox(root, [.13, 5.8, .13], [x, 2.9, z]);
    beam(root, [x, 5.8, z], [x - 1.5, 5.8, z], .052);
    inkBox(root, [.64, .1, .22], [x - 1.3, 5.73, z]);
    inkBox(root, [.3, .1, .3], [x, .05, z]);
  }
  // Overhead service wire, and a remote crane visible over the tanks.
  line(root, [[-65, 8, -49], [-18, 7.5, -52], [45, 8, -49]], 0x777777);
  beam(root, [56, 0, -66], [56, 22, -66], .13, 0xc9a06a);
  beam(root, [56, 22, -66], [31, 20, -66], .1, 0xc9a06a);
  beam(root, [56, 22, -66], [62, 19, -66], .12);
  line(root, [[31, 20, -66], [31, 10, -66]], 0x555555);
  label(root, "STAGING / SAFE AREA", 4.4, [-10, 1.6, 62.36]);
  label(root, "WEAPONS & SUPPLIES", 2.6, [.1, .28, 56.6]);
  const checkpoints = roads(root);
  batchInk(root);

  // ---- Animated dressing (added after batching so it stays live) ----
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    const puffs = 2 + (i % 3);
    for (let p = 0; p < puffs; p++) {
      const s = 6 + ((i * 3 + p * 5) % 7);
      const puff = inkify(new THREE.SphereGeometry(s, 7, 5), { color: 0xffffff, edgeAngle: 45 });
      puff.position.set(p * s * 1.1 - puffs * s * 0.5, (p % 2) * 1.5, 0);
      puff.scale.y = 0.55;
      cloud.add(puff);
    }
      cloud.position.set(-260 + ((i * 97) % 520), 62 + ((i * 31) % 30), -180 + ((i * 53) % 480));
      // Each cloud's puffs share one fill batch and one outline batch.
      batchInk(cloud);
      root.add(cloud);
      clouds.push(cloud);
  }

  // Per-gate beacon lamps: green cleared / amber next / gray upcoming.
  const beacons: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  for (const gate of checkpoints) {
    const mat = new THREE.MeshBasicMaterial({ color: GATE_TODO });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), mat);
    lamp.position.set(gate.position.x, 5.6, gate.position.z);
    root.add(lamp);
    beacons.push({ mesh: lamp, mat });
  }
  // Tower warning beacons.
  const towerBeacons: THREE.Mesh[] = [];
  for (const t of TOWERS) {
    const lamp = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22),
      new THREE.MeshBasicMaterial({ color: 0xd64545 }),
    );
    lamp.position.set(t.pos[0], t.platformHeight + 5.9, t.pos[2]);
    root.add(lamp);
    towerBeacons.push(lamp);
  }
  // Extraction light column.
  const finish = CHECKPOINTS[CHECKPOINTS.length - 1];
  const beamMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 3.4, 60, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x2a9d48, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
  );
  beamMesh.position.set(finish[0], 30, finish[2]);
  root.add(beamMesh);

  // Team deployment pads: readable faction home bases for 5v5.
  const teamPads: { team: "blue" | "red"; ring: THREE.Mesh; beacon: THREE.Mesh }[] = [];
  for (const team of ["blue", "red"] as const) {
    const color = TEAM_COLORS[team];
    const spawns = TEAM_SPAWNS[team];
    const centre: Vec3 = [
      spawns.reduce((sum, p) => sum + p[0], 0) / spawns.length,
      0,
      spawns.reduce((sum, p) => sum + p[2], 0) / spawns.length,
    ];
    const ring = new THREE.Mesh(new THREE.RingGeometry(7.3, 7.8, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(centre[0], 0.04, centre[2]); root.add(ring);
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.48), new THREE.MeshBasicMaterial({ color }));
    beacon.position.set(centre[0], 4.2, centre[2]); root.add(beacon);
    label(root, team === "blue" ? "BLUE DEPLOY" : "RED DEPLOY", 3.5, [centre[0], 1.55, centre[2] + (team === "blue" ? 8 : -8)]);
    teamPads.push({ team, ring, beacon });
  }

  const bike = makeBike(); bike.position.set(...BIKE.pos); bike.rotation.y = BIKE.yaw; root.add(bike);
  const bikePosition = [...BIKE.pos] as Vec3;

  const update = (dt: number, elapsed: number, nextCheckpoint: number) => {
    for (let i = 0; i < clouds.length; i++) {
      const cloud = clouds[i];
      cloud.position.x += dt * (1.1 + (i % 3) * 0.5);
      if (cloud.position.x > 300) cloud.position.x = -300;
    }
    for (let i = 0; i < beacons.length; i++) {
      const b = beacons[i];
      if (nextCheckpoint < 0) {
        b.mat.color.setHex(GATE_TODO);
        b.mesh.scale.setScalar(1);
      } else if (i < nextCheckpoint) {
        b.mat.color.setHex(GATE_DONE);
        b.mesh.scale.setScalar(1);
      } else if (i === nextCheckpoint) {
        b.mat.color.setHex(GATE_NEXT);
        b.mesh.scale.setScalar(1 + Math.sin(elapsed * 6) * 0.35);
      } else {
        b.mat.color.setHex(GATE_TODO);
        b.mesh.scale.setScalar(1);
      }
    }
    const blink = Math.sin(elapsed * 3.2) > 0 ? 1 : 0.25;
    for (const lamp of towerBeacons) lamp.scale.setScalar(blink);
    for (const pad of teamPads) {
      const pulse = 1 + Math.sin(elapsed * 2.2 + (pad.team === "blue" ? 0 : Math.PI)) * 0.08;
      pad.ring.scale.setScalar(pulse);
      pad.beacon.rotation.y += dt * 1.3;
      pad.beacon.scale.setScalar(0.9 + pulse * 0.15);
    }
    beamMesh.rotation.y += dt * 0.4;
  };

  return {
    root, bike, bikePosition, hostagePosition: HOSTAGE.pos, ladders: LADDERS, checkpoints, update,
    dispose: () => { disposeObject(root); scene.remove(root); },
  };
}
