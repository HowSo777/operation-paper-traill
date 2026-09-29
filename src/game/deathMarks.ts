/** Red paint dropped at a body so a kill is readable on the white ground. */
import * as THREE from "three";
import type { Vec3 } from "./types";

const PAINT = 0xc1121f;

export class DeathMarks {
  private root = new THREE.Group();
  private marks: THREE.Group[] = [];
  private painted = new Set<string>();
  constructor(private scene: THREE.Scene) {
    scene.add(this.root);
  }

  spawn(id: string, pos: Vec3): void {
    if (this.painted.has(id)) return;
    this.painted.add(id);
    const splat = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
      color: PAINT,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.62, 11), material);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(pos[0], 0.035, pos[2]);
    splat.add(pool);
    for (let i = 0; i < 6; i++) {
      const radius = 0.11 + (i % 3) * 0.07;
      const drip = new THREE.Mesh(new THREE.CircleGeometry(radius, 8), material);
      drip.rotation.x = -Math.PI / 2;
      const angle = i * 1.047 + pos[0] * 0.2;
      const distance = 0.28 + (i % 4) * 0.18;
      drip.position.set(pos[0] + Math.cos(angle) * distance, 0.036, pos[2] + Math.sin(angle) * distance);
      splat.add(drip);
    }
    this.root.add(splat);
    this.marks.push(splat);
  }

  reset(): void {
    for (const mark of this.marks) {
      this.root.remove(mark);
      mark.traverse(child => {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach(item => item.dispose());
        else material?.dispose();
      });
    }
    this.marks = [];
    this.painted.clear();
  }

  dispose(): void {
    this.reset();
    this.scene.remove(this.root);
  }
}
