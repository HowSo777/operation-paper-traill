/**
 * Explosive drums: visibly red, opaque and solid — a bullet detonates them,
 * and the blast chains to anything close. They give every new yard a weapon
 * the player can use against the guards.
 */
import * as THREE from "three";
import { BARRELS, type BarrelDef } from "./mapData";
import { disposeObject, inkify, label } from "./ink";
import type { AABB, Vec3 } from "./types";

export type Barrel = BarrelDef & { alive: boolean; mesh: THREE.Group; debris: THREE.Mesh };

const centreKey = (x: number, z: number) => `${x.toFixed(3)},${z.toFixed(3)}`;

export class Barrels {
  items: Barrel[] = [];
  private byCentre = new Map<string, Barrel>();

  constructor(private scene: THREE.Scene, defs: BarrelDef[] = BARRELS) {
    for (const def of defs) {
      const mesh = new THREE.Group();
      mesh.position.set(def.pos[0], def.pos[1], def.pos[2]);

      const body = inkify(
        new THREE.CylinderGeometry(def.radius, def.radius, def.height, 14),
        { color: 0xc4441f, edgeAngle: 30, silhouette: true },
      );
      body.position.y = def.height / 2;
      mesh.add(body);
      for (const y of [def.height * 0.27, def.height * 0.73]) {
        const ring = inkify(new THREE.TorusGeometry(def.radius + 0.012, 0.02, 5, 16), { color: 0x2c2c2c, edgeAngle: 40 });
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        mesh.add(ring);
      }
      label(mesh, "FLAMMABLE", 1.1, [0, def.height * 0.5, def.radius + 0.04]);
      this.scene.add(mesh);

      const debris = new THREE.Mesh(
        new THREE.CircleGeometry(def.radius * 0.85, 9),
        new THREE.MeshBasicMaterial({ color: 0x3a2a24, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
      );
      debris.rotation.x = -Math.PI / 2;
      debris.position.set(def.pos[0], 0.033, def.pos[2]);
      debris.visible = false;
      this.scene.add(debris);

      const item: Barrel = { ...def, pos: [...def.pos] as Vec3, alive: true, mesh, debris };
      this.items.push(item);
      this.byCentre.set(centreKey(def.pos[0], def.pos[2]), item);
    }
  }

  /** Match the AABB a bullet struck back to the barrel it belongs to. */
  hitByBox(box: AABB): Barrel | null {
    return this.byCentre.get(centreKey((box.min[0] + box.max[0]) / 2, (box.min[2] + box.max[2]) / 2)) ?? null;
  }

  destroy(barrel: Barrel): void {
    barrel.alive = false;
    barrel.mesh.visible = false;
    barrel.debris.visible = true;
  }

  reset(): void {
    for (const barrel of this.items) {
      barrel.alive = true;
      barrel.mesh.visible = true;
      barrel.debris.visible = false;
    }
  }

  dispose(): void {
    for (const barrel of this.items) {
      this.scene.remove(barrel.mesh, barrel.debris);
      disposeObject(barrel.mesh);
      barrel.debris.geometry.dispose();
      (barrel.debris.material as THREE.Material).dispose();
    }
    this.items = [];
    this.byCentre.clear();
  }
}
