/** White opaque surfaces + crease edges. No triangle wireframe or floor grid. */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Vec3 } from "./types";
export const INK = 0x35485a;
export const PAPER = 0xf7f5ee;
export type Vec3Tuple = Vec3;
export type InkOptions = { hatch?: number; edgeAngle?: number; color?: number; lineColor?: number; map?: THREE.Texture | null; transparent?: boolean; opacity?: number; side?: THREE.Side; silhouette?: boolean };
export const inkLineMaterial = (color = INK) => new THREE.LineBasicMaterial({ color });
export const paperMaterial = () => new THREE.MeshBasicMaterial({ color: PAPER });

export function inkMesh(geometry: THREE.BufferGeometry, options: InkOptions = {}): THREE.Mesh {
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: options.color ?? PAPER, map: options.map ?? null,
    transparent: options.transparent ?? false, opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  }));
}
export function inkify(geometry: THREE.BufferGeometry, options: InkOptions = {}): THREE.Group {
  const group = new THREE.Group();
  group.add(inkMesh(geometry, options));
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, options.edgeAngle ?? 26), inkLineMaterial(options.lineColor)));
  if (options.silhouette) {
    const hull = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: options.lineColor ?? INK, side: THREE.BackSide }));
    hull.scale.setScalar(1.003);
    group.add(hull);
  }
  return group;
}
export function boxGeometry(size: Vec3): THREE.BoxGeometry { return new THREE.BoxGeometry(...size); }
export function inkBox(parent: THREE.Object3D, size: Vec3, pos: Vec3, options: InkOptions = {}): THREE.Group {
  const box = inkify(boxGeometry(size), options);
  box.position.set(...pos);
  parent.add(box);
  return box;
}
export function beam(parent: THREE.Object3D, from: Vec3, to: Vec3, width = 0.06, color = PAPER): THREE.Group {
  const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
  const group = inkify(new THREE.CylinderGeometry(width, width, start.distanceTo(end), 6), { color, edgeAngle: 35 });
  group.position.copy(start).add(end).multiplyScalar(0.5);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  parent.add(group);
  return group;
}
export function line(parent: THREE.Object3D, points: Vec3[], color = INK): THREE.Line {
  const object = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p))), inkLineMaterial(color));
  parent.add(object);
  return object;
}
export function mergeBoxes(boxes: { pos: Vec3; size: Vec3; rotY?: number }[]): THREE.BufferGeometry {
  const geos = boxes.map(b => {
    const geo = boxGeometry(b.size);
    geo.rotateY(b.rotY ?? 0);
    geo.translate(...b.pos);
    return geo;
  });
  const merged = mergeGeometries(geos, false) ?? new THREE.BufferGeometry();
  geos.forEach(g => g.dispose());
  return merged;
}

export function labelTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = "#333"; ctx.font = "500 48px monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, 512, 66, 970);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export function label(parent: THREE.Object3D, text: string, width: number, pos: Vec3): THREE.Mesh {
  const object = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 8), new THREE.MeshBasicMaterial({ map: labelTexture(text), side: THREE.DoubleSide }));
  object.position.set(...pos);
  parent.add(object);
  return object;
}
export function textSprite(text: string): THREE.Sprite {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(text), depthTest: true }));
  sprite.scale.set(1.8, 0.225, 1);
  return sprite;
}
/** Collapse static untextured scenery into a few material batches. */
export function batchInk(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const batches = new Map<string, { vertices: number[]; material: THREE.Material; lines: boolean }>();
  const remove: THREE.Object3D[] = [];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const v = new THREE.Vector3();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;
    if (Array.isArray(object.material)) return;
    const material = object.material as THREE.MeshBasicMaterial | THREE.LineBasicMaterial;
    if ((material as THREE.MeshBasicMaterial).map) return;
    const isLine = object instanceof THREE.Line;
    const key = [isLine, material.color.getHex(), material.side, material.opacity, material.polygonOffset].join(":");
    let batch = batches.get(key);
    if (!batch) { batch = { vertices: [], material: material.clone(), lines: isLine }; batches.set(key, batch); }
    const attribute = object.geometry.getAttribute("position");
    const index = object.geometry.getIndex();
    const count = index ? index.count : attribute.count;
    const append = (i: number) => {
      v.fromBufferAttribute(attribute, index ? index.getX(i) : i).applyMatrix4(object.matrixWorld).applyMatrix4(inverseRoot);
      batch!.vertices.push(v.x, v.y, v.z);
    };
    if (isLine && !(object instanceof THREE.LineSegments)) {
      for (let i = 1; i < count; i++) { append(i - 1); append(i); }
    } else for (let i = 0; i < count; i++) append(i);
    remove.push(object); geometries.add(object.geometry); materials.add(material);
  });
  remove.forEach(object => object.removeFromParent());
  for (const batch of batches.values()) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(batch.vertices, 3));
    geometry.computeBoundingSphere();
    root.add(batch.lines ? new THREE.LineSegments(geometry, batch.material) : new THREE.Mesh(geometry, batch.material));
  }
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}

export function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material);
        const map = (material as THREE.MeshBasicMaterial).map;
        if (map) textures.add(map);
      }
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}
