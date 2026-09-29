/** Ironworks: self-contained 5v5 arena, batched into a handful of GPU draws. */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ARENA_BOXES, ARENA_LADDERS, ARENA_TEAM_SPAWNS } from "./arena";
import { TEAM_COLORS } from "./mapData";
import { disposeObject, inkBox, label, mergeBoxes } from "./ink";
import type { World } from "./world";
import type { BoxDef, TeamId, Vec3 } from "./types";

const INK = 0x35485a;
const FILL: Record<string, number> = {
  wall: 0x91a4ad, building: 0xb8c9c9, platform: 0x7f9ba5,
  container: 0x78b4c1, railing: 0x506b76, pillar: 0x62818a, crate: 0xd6b978,
};

/** 60+ static boxes become at most five filled batches plus one outline draw. */
function batchStaticGeometry(root: THREE.Group): void {
  const byColor = new Map<number, THREE.BufferGeometry[]>();
  const edgeGeometries: THREE.BufferGeometry[] = [];
  for (const box of ARENA_BOXES) {
    if (box.kind === "ground") continue;
    const color = box.kind === "container" ? (box.pos[0] < 0 ? 0x4fa7c4 : 0xd77859) : (FILL[box.kind] ?? 0xc0c2ba);
    const geometry = new THREE.BoxGeometry(box.size[0], box.size[1], box.size[2]);
    geometry.translate(box.pos[0], box.pos[1], box.pos[2]);
    const batch = byColor.get(color) ?? [];
    batch.push(geometry); byColor.set(color, batch);
    const edges = new THREE.EdgesGeometry(geometry, 26);
    edgeGeometries.push(edges);
  }
  for (const [color, geometries] of byColor) {
    const geometry = mergeGeometries(geometries, false);
    if (geometry) {
      // Palette is baked into color batches; unlit surfaces skip PBR lighting
      // and preserve the ink/color art direction at a fraction of shader cost.
      root.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.FrontSide, fog: true })));
    }
    geometries.forEach(g => g.dispose());
  }
  const edges = mergeGeometries(edgeGeometries, false);
  if (edges) root.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: INK })));
  edgeGeometries.forEach(g => g.dispose());
}

/** One line draw for hazard stripes, container ribs and aerial details. */
function addLineBatch(root: THREE.Object3D, segments: [Vec3, Vec3][], color: number, opacity = 1): void {
  if (!segments.length) return;
  const values: number[] = [];
  for (const [a, b] of segments) values.push(...a, ...b);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(values, 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  root.add(new THREE.LineSegments(geometry, material));
}

function staticDetails(root: THREE.Group): void {
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(9, 80), new THREE.MeshLambertMaterial({ color: 0xb7b4ac, side: THREE.DoubleSide }));
  strip.rotation.x = -Math.PI / 2; strip.position.y = .013; root.add(strip);
  // All broken centre-line dashes share a single mesh.
  const markers: number[] = [];
  for (let z = -38; z < 38; z += 6) markers.push(-.06, .018, z, .06, .018, z, -.06, .018, z + 2.5, .06, .018, z + 2.5);
  const markerGeo = new THREE.BufferGeometry(); markerGeo.setAttribute("position", new THREE.Float32BufferAttribute(markers, 3));
  root.add(new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xfaf4de, side: THREE.DoubleSide })));

  const details: [Vec3, Vec3][] = [];
  for (let x = -6.6; x <= 6.6; x += 1.65) {
    details.push([[x, .035, 7.2], [x + .8, .035, 8.0]]);
    details.push([[x, .035, -7.2], [x + .8, .035, -8.0]]);
  }
  // Container ribs are all line geometry, batched instead of one draw per rib.
  for (const box of ARENA_BOXES.filter(b => b.kind === "container")) {
    const [x, y, z] = box.pos; const [w, h, d] = box.size;
    for (let dx = -w / 2 + .55; dx < w / 2; dx += .8) {
      details.push([[x + dx, y - h / 2 + .06, z + d / 2 + .014], [x + dx, y + h / 2 - .06, z + d / 2 + .014]]);
    }
  }
  for (const x of [-5.5, 5.5]) {
    details.push([[x, 6.4, -3], [x, 8.5, -3]], [[x - .5, 8.2, -3], [x + .5, 8.2, -3]]);
  }
  addLineBatch(root, details, 0x536871);

  label(root, "IRONWORKS / FORGE 05", 6.6, [0, 4.5, 6.04]);
  const reverse = label(root, "IRONWORKS / FORGE 05", 6.6, [0, 4.5, -6.04]); reverse.rotation.y = Math.PI;
  // Batch all ladder rails/rungs across the three routes to height.
  const ladderBoxes: { pos: Vec3; size: Vec3 }[] = [];
  for (const ladder of ARENA_LADDERS) {
    const [x, , z] = ladder.pos;
    for (const side of [-.34, .34]) ladderBoxes.push({ pos: [x + side, ladder.yMax / 2 + .3, z], size: [.055, ladder.yMax + .6, .055] });
    for (let y = .24; y <= ladder.yMax + .35; y += .37) ladderBoxes.push({ pos: [x, y, z], size: [.7, .045, .045] });
  }
  const ladderGeo = mergeBoxes(ladderBoxes);
  const ladderEdges = new THREE.EdgesGeometry(ladderGeo, 26);
  root.add(new THREE.Mesh(ladderGeo, new THREE.MeshLambertMaterial({ color: 0x93a3a6 })));
  root.add(new THREE.LineSegments(ladderEdges, new THREE.LineBasicMaterial({ color: INK })));
}

export function buildArenaWorld(scene: THREE.Scene): World {
  const root = new THREE.Group(); scene.add(root);
  scene.background = new THREE.Color(0xdce9ef); scene.fog = new THREE.Fog(0xdce9ef, 90, 190);
  // Warm flat lighting keeps visible form without expensive shadow-map passes.
  root.add(new THREE.HemisphereLight(0xfff6e6, 0x81909d, 1.8));
  const sun = new THREE.DirectionalLight(0xffe9cb, 1.0); sun.position.set(-34, 65, -22); root.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 98), new THREE.MeshLambertMaterial({ color: 0xe4e3dc }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = .008; root.add(ground);
  batchStaticGeometry(root); staticDetails(root);

  const pads: { ring: THREE.Mesh; beacon: THREE.Mesh; team: TeamId }[] = [];
  for (const team of ["blue", "red"] as const) {
    const points = ARENA_TEAM_SPAWNS[team];
    const x = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const z = points.reduce((sum, p) => sum + p[2], 0) / points.length;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(10, 32), new THREE.MeshBasicMaterial({ color: TEAM_COLORS[team], transparent: true, opacity: .13, depthWrite: false, side: THREE.DoubleSide }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(x, .025, z); root.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(7.6, 8.1, 32), new THREE.MeshBasicMaterial({ color: TEAM_COLORS[team], transparent: true, opacity: .86, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, .03, z); root.add(ring);
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(.48), new THREE.MeshBasicMaterial({ color: TEAM_COLORS[team] }));
    beacon.position.set(x, 3.4, z); root.add(beacon);
    label(root, team === "blue" ? "BLUE / DEPLOY" : "RED / DEPLOY", 3.7, [x, .035, z + (team === "blue" ? 10 : -10)]);
    pads.push({ ring, beacon, team });
  }
  for (const x of [-26, 26]) {
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(.2, 6, 5), new THREE.MeshBasicMaterial({ color: x < 0 ? 0x65b8df : 0xee896a }));
    beacon.position.set(x, 6.2, 0); root.add(beacon);
  }
  const bike = new THREE.Group(); bike.visible = false; bike.userData.wheels = [] as THREE.Group[]; root.add(bike);
  return {
    root, bike, bikePosition: [0, 0, 0], hostagePosition: [0, 0, 0], ladders: ARENA_LADDERS, checkpoints: [],
    update: (dt, elapsed) => {
      for (const pad of pads) {
        const phase = elapsed * 2.2 + (pad.team === "red" ? Math.PI : 0);
        pad.ring.scale.setScalar(1 + Math.sin(phase) * .035);
        pad.beacon.rotation.y += dt * 1.1; pad.beacon.position.y = 3.4 + Math.sin(phase) * .2;
      }
    },
    dispose: () => { disposeObject(root); scene.remove(root); },
  };
}
