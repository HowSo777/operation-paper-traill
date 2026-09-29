/** Local weapon pickups: crate supplies and weapons dropped by AI guards. */
import * as THREE from "three";
import { PICKUP_SPAWNS, WEAPONS, type PickupDef } from "./armament";
import { hasLineOfSight } from "./collision";
import { makeGun } from "./gunModels";
import { batchInk, disposeObject, inkBox, line, textSprite } from "./ink";
import { getBlockerAabbs } from "./mapData";
import type { Vec3, WeaponKind } from "./types";
export type Pickup = PickupDef & { mesh: THREE.Group; taken: boolean };
export class Pickups {
  items: Pickup[] = [];
  private counter = 0;
  constructor(private scene: THREE.Scene, private spawns: PickupDef[] = PICKUP_SPAWNS) { this.reset(); }
  private add(def: PickupDef): Pickup {
    const mesh = new THREE.Group(); mesh.position.set(...def.pos);
    if (def.kind === "ammo") {
      inkBox(mesh, [.46, .24, .27], [0, .03, 0], { color: 0xeeeeee });
      for (const x of [-.15, .15]) inkBox(mesh, [.045, .27, .29], [x, .03, 0]);
    } else {
      const gun = makeGun(def.kind); gun.rotation.z = Math.PI / 2; gun.rotation.y = def.yaw;
      mesh.add(gun);
    }
    const tag = textSprite(def.kind === "ammo" ? "AMMO" : WEAPONS[def.kind].name);
    tag.position.y = .39; tag.scale.set(1.1, .138, 1); mesh.add(tag);
    line(mesh, [[-.075,.6,0],[0,.69,0],[.075,.6,0],[0,.51,0],[-.075,.6,0]],0x333333);
    batchInk(mesh);
    this.scene.add(mesh);
    const item = {...def, mesh, taken:false};this.items.push(item);return item;
  }
  nearest(pos: Vec3, direction: Vec3): Pickup | null {
    let nearest: Pickup | null = null, closest = 2.8;
    const eye:Vec3=[pos[0],pos[1]+1.55,pos[2]];
    for(const item of this.items) {
      if(item.taken || Math.abs(item.pos[1]-pos[1])>1.9) continue;
      const dx=item.pos[0]-pos[0], dz=item.pos[2]-pos[2], distance=Math.hypot(dx,dz);
      if(distance>=closest || (dx*direction[0]+dz*direction[2]) < -.3) continue;
      if(!hasLineOfSight(eye,[item.pos[0],item.pos[1]+.12,item.pos[2]],getBlockerAabbs())) continue;
      closest=distance;nearest=item;
    }
    return nearest;
  }
  take(item: Pickup): void { item.taken=true;item.mesh.visible=false; }
  drop(kind: WeaponKind | "ammo",pos: Vec3): void {
    if(this.items.length>35)return;
    this.add({id:`drop-${++this.counter}`,kind,pos:[pos[0],pos[1]+.2,pos[2]],yaw:Math.random()*Math.PI});
  }
  reset(): void {
    this.items.forEach(i=>{this.scene.remove(i.mesh);disposeObject(i.mesh);}); this.items=[];
    this.spawns.forEach(def=>this.add({...def,pos:[...def.pos]}));
  }
  dispose(): void {this.items.forEach(i=>{this.scene.remove(i.mesh);disposeObject(i.mesh);});this.items=[];}
}
