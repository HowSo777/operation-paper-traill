/** Ink visuals for the pursuing motorcycles and their riders. */
import * as THREE from "three";
import { makeBike, makeHumanoid, type Humanoid } from "./actors";
import { disposeObject, textSprite } from "./ink";
import type { Pursuit, PursuerState } from "./pursuit";

type PursuerView = { state: PursuerState; bike: THREE.Group; rider: Humanoid; flash: THREE.Mesh; tag: THREE.Sprite };
export class PursuitViews {
  private views = new Map<string, PursuerView>();
  constructor(private scene: THREE.Scene) {}
  sync(pursuit: Pursuit): void {
    for (const state of pursuit.entries) {
      if (this.views.has(state.id)) continue;
      const bike = makeBike();
      const rider = makeHumanoid({ weapon: "smg", color: 0x333333 });
      rider.group.position.set(0, .27, .05);
      rider.group.rotation.x = -.1;
      rider.hipL.rotation.x = -1.1; rider.hipR.rotation.x = -1.1;
      rider.group.scale.setScalar(.92);
      const tag = textSprite("RIDER"); tag.position.set(0, 2.2, 0); tag.visible = false;
      const flash = new THREE.Mesh(new THREE.SphereGeometry(.09, 5, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      flash.visible = false;
      rider.weapon?.add(flash); flash.position.set(0, 0, -.7);
      bike.add(rider.group, tag);
      this.scene.add(bike);
      this.views.set(state.id, { state, bike, rider, flash, tag });
    }
    for (const [id, view] of this.views) {
      if (!pursuit.entries.some(entry => entry.id === id)) {
        this.scene.remove(view.bike); disposeObject(view.bike); this.views.delete(id);
      }
    }
  }
  update(): void {
    for (const view of this.views.values()) {
      const s = view.state;
      if (!s.alive) {
        view.bike.visible = true;
        view.bike.position.set(s.pos[0], 0.32, s.pos[2]);
        view.bike.rotation.set(Math.PI / 2, s.heading, 0);
        view.flash.visible = false;
        view.tag.visible = false;
        continue;
      }
      view.bike.visible = true;
      view.bike.position.set(...s.pos);
      view.bike.rotation.set(0, s.heading, 0);
      const wheels = view.bike.userData.wheels as THREE.Group[];
      wheels.forEach(wheel => { wheel.rotation.x = -s.wheelAngle; });
      view.rider.group.rotation.y = 0;
      view.flash.visible = s.firing;
      view.tag.visible = true;
    }
  }
  dispose(): void {
    for (const view of this.views.values()) { this.scene.remove(view.bike); disposeObject(view.bike); }
    this.views.clear();
  }
}
