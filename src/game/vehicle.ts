/** Pure motorcycle physics; small substeps prevent tunnelling into thin fences. */
import { clamp, damp, moveAndCollide } from "./collision";
import { BIKE, CHECKPOINTS, WORLD } from "./mapData";
import type { AABB, Vec3 } from "./types";
export type BikeInput = { throttle: boolean; brake: boolean; left: boolean; right: boolean; handbrake: boolean };
export class BikeController {
  pos: Vec3 = [...BIKE.pos];
  yaw = BIKE.yaw;
  speed = 0;
  steering = 0;
  lean = 0;
  riding = false;
  checkpoint = 0;
  wheelAngle = 0;
  collisionCooldown = 0;
  constructor(private solids: AABB[]) {}
  reset(): void {
    this.pos = [...BIKE.pos]; this.yaw = BIKE.yaw; this.speed = 0;
    this.steering = 0; this.lean = 0; this.riding = false; this.checkpoint = 0;
  }
  mount(): void { this.riding = true; this.speed = 0; }
  dismount(): boolean {
    if (Math.abs(this.speed) > 2) return false;
    this.riding = false; this.speed = 0; this.lean = 0; return true;
  }
  update(dt: number, input: BikeInput): { collision: boolean; checkpointPassed: boolean } {
    let collision = false;
    this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);
    if (!this.riding) return { collision, checkpointPassed: false };
    const previousPosition: Vec3 = [...this.pos];
    const oldSpeed = Math.abs(this.speed);
    if (input.handbrake) this.speed = damp(this.speed, 0, 9, dt);
    else if (input.brake) this.speed = Math.max(-5, this.speed - (this.speed > 0 ? 22 : 5) * dt);
    else if (input.throttle) this.speed = Math.min(24, this.speed + 9 * dt);
    else this.speed = damp(this.speed, 0, .95, dt);
    if (Math.abs(this.speed) < .04) this.speed = 0;
    const turn = Number(input.right) - Number(input.left);
    this.steering = damp(this.steering, turn, 7, dt);
    this.yaw -= this.steering * 1.38 * clamp(this.speed / 8, -0.7, 1) * dt;
    this.lean = damp(this.lean, -this.steering * Math.min(Math.abs(this.speed) / 24, 1) * .28, 7, dt);
    const half: Vec3 = [.48 * Math.abs(Math.cos(this.yaw)) + .98 * Math.abs(Math.sin(this.yaw)), 0, .98 * Math.abs(Math.cos(this.yaw)) + .48 * Math.abs(Math.sin(this.yaw))];
    const steps = Math.max(1, Math.ceil(Math.abs(this.speed) * dt / .23));
    for (let i = 0; i < steps; i++) {
      const velocity: Vec3 = [-Math.sin(this.yaw) * this.speed, -0.8, -Math.cos(this.yaw) * this.speed];
      const result = moveAndCollide(this.pos, half, 1.45, velocity, dt / steps, this.solids);
      if (result.hitWall) { this.speed *= .15; collision = oldSpeed > 7 && this.collisionCooldown === 0; this.collisionCooldown = .8; break; }
    }
    this.pos[0] = clamp(this.pos[0], -WORLD.outer + 2, WORLD.outer - 2);
    this.pos[2] = clamp(this.pos[2], WORLD.north + 2, WORLD.south - 2);
    this.wheelAngle += this.speed * dt / .42;
    let checkpointPassed = false;
    const target = CHECKPOINTS[this.checkpoint];
    // Next-gate proximity: the painted centreline and the trigger share the same
    // point, so a 9m radius cannot skip a 30m+ gap even at top speed.
    if (target && Math.abs(this.speed) > 0.8) {
      const now = Math.hypot(this.pos[0] - target[0], this.pos[2] - target[2]);
      const was = Math.hypot(previousPosition[0] - target[0], previousPosition[2] - target[2]);
      if (now < 9 || (was >= 9 && now < 12)) {
        this.checkpoint++;
        checkpointPassed = true;
      }
    }
    return { collision, checkpointPassed };
  }
}
