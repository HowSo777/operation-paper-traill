/** Pointer-lock FPS controller with collision, crouching, jumps and ladders. */
import { aabbOverlap, actorBox, clamp, damp, moveAndCollide } from "./collision";
import { TUNING, WORLD } from "./mapData";
import type { AABB, Vec3 } from "./types";
export type Ladder={pos:Vec3;yMin:number;yMax:number;radius:number};
export type PlayerMods={speed:number;regen:number;armor:number};
export const settings={sensitivity:.002,invertY:false};
const MOVE_KEYS=new Set(["KeyW","KeyA","KeyS","KeyD","Space","ShiftLeft","ShiftRight","ControlLeft","KeyC","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"]);
export class Player {
  pos:Vec3=[0,0,0];vel:Vec3=[0,0,0];yaw=0;pitch=0;health:number=100;alive=true;grounded=false;
  onLadder=false;crouching=false;sprinting=false;landDip=0;bobPhase=0;timeSinceDamage=99;lastDamageBearing=0;
  mods:PlayerMods={speed:1,regen:1,armor:0};
  /** Heavy/aimed weapons slow movement without overwriting perk speed. */
  weaponSpeed=1;
  private keys=new Set<string>();private attached=false;private enabled=false;private dragging=false;private ladderCooldown=0;
  constructor(private solids:AABB[],private ladders:Ladder[]){}
  attach():void {
    if(this.attached)return;this.attached=true;
    window.addEventListener("keydown",this.onKeyDown);window.addEventListener("keyup",this.onKeyUp);
    window.addEventListener("blur",this.clearInput);document.addEventListener("mousemove",this.onMouseMove);
    document.addEventListener("mousedown",this.onMouseDown);document.addEventListener("mouseup",this.onMouseUp);
  }
  detach():void {
    this.attached=false;window.removeEventListener("keydown",this.onKeyDown);window.removeEventListener("keyup",this.onKeyUp);
    window.removeEventListener("blur",this.clearInput);document.removeEventListener("mousemove",this.onMouseMove);
    document.removeEventListener("mousedown",this.onMouseDown);document.removeEventListener("mouseup",this.onMouseUp);this.clearInput();
  }
  private ignoreLookEvents=0;
  setEnabled(value:boolean):void {this.enabled=value;if(value)this.ignoreLookEvents=2;else this.clearInput();}
  clearInput=()=>{this.keys.clear();this.dragging=false;};
  private onKeyDown=(e:KeyboardEvent)=>{if(!this.enabled)return;if(MOVE_KEYS.has(e.code))e.preventDefault();this.keys.add(e.code);};
  private onKeyUp=(e:KeyboardEvent)=>{this.keys.delete(e.code);};
  private onMouseDown=()=>{this.dragging=true;};
  private onMouseUp=()=>{this.dragging=false;};
  private onMouseMove=(e:MouseEvent)=>{
    if(!this.enabled || (!document.pointerLockElement && !this.dragging))return;
    // Browsers may report the cursor-recentering warp as a large relative delta.
    this.yaw-=e.movementX*settings.sensitivity;
    this.pitch=clamp(this.pitch-e.movementY*settings.sensitivity*(settings.invertY?-1:1),-1.53,1.53);
  };
  touchForward = 0;
  touchStrafe = 0;
  touchJump = false;
  setMoveAxes(forward: number, strafe: number): void {
    this.touchForward = clamp(forward, -1, 1);
    this.touchStrafe = clamp(strafe, -1, 1);
  }
  jump(): void {
    if (this.grounded) {
      this.vel[1] = TUNING.player.jumpSpeed;
      this.grounded = false;
    } else {
      this.touchJump = true;
    }
  }
  addLookDelta(dx: number, dy: number): void {
    if (!this.enabled) return;
    this.yaw -= dx * settings.sensitivity;
    this.pitch = clamp(this.pitch - dy * settings.sensitivity * (settings.invertY ? -1 : 1), -1.53, 1.53);
  }
  isDown(code:string):boolean {return this.keys.has(code);}
  respawn(pos:Vec3,yaw:number):void {
    this.pos=[...pos];this.vel=[0,0,0];this.yaw=yaw;this.pitch=.005;this.health=100;this.alive=true;
    this.timeSinceDamage=99;this.onLadder=false;this.grounded=false;this.crouching=false;this.sprinting=false;
    this.landDip=0;this.bobPhase=0;this.lastDamageBearing=0;this.clearInput();
  }
  applyDamage(amount:number,from?:Vec3):void {
    if(!this.alive)return;this.health=Math.max(0,this.health-amount*(1-this.mods.armor));this.timeSinceDamage=0;
    if(from)this.lastDamageBearing=Math.atan2(-(from[0]-this.pos[0]),-(from[2]-this.pos[2]));
  }
  eyePosition():Vec3 {return[this.pos[0],this.pos[1]+TUNING.player.eyeHeight-(this.crouching?.48:0),this.pos[2]];}
  lookDirection():Vec3 {const c=Math.cos(this.pitch);return[-Math.sin(this.yaw)*c,Math.sin(this.pitch),-Math.cos(this.yaw)*c];}
  update(dt:number):void {
    if(!this.alive)return;
    const t=TUNING.player;this.timeSinceDamage+=dt;this.ladderCooldown=Math.max(0,this.ladderCooldown-dt);
    const forward=clamp(Number(this.isDown("KeyW"))-Number(this.isDown("KeyS"))+this.touchForward,-1,1);
    const strafe=clamp(Number(this.isDown("KeyD"))-Number(this.isDown("KeyA"))+this.touchStrafe,-1,1);
    let crouch=this.isDown("KeyC")||this.isDown("ControlLeft");
    if(this.crouching&&!crouch){const head=actorBox(this.pos,[t.radius,0,t.radius],t.height);crouch=this.solids.some(b=>aabbOverlap(head,b));}
    this.crouching=crouch;this.sprinting=!crouch&&forward>0&&(this.isDown("ShiftLeft")||this.isDown("ShiftRight"));
    const ladder=this.ladderCooldown===0?this.ladders.find(l=>Math.hypot(this.pos[0]-l.pos[0],this.pos[2]-l.pos[2])<l.radius+.12&&this.pos[1]>=-.1&&this.pos[1]<=l.yMax+.25):undefined;
    if(ladder&&(forward!==0||this.onLadder||Math.abs(this.pitch)>.35)){
      this.onLadder=true;this.vel=[0,0,0];
      const looking=Math.abs(this.pitch)>.35?Math.sign(this.pitch):1;
      const climb=(forward===0?looking:forward*looking)*t.ladderSpeed;
      this.pos[0]=damp(this.pos[0],ladder.pos[0],9,dt);
      this.pos[2]=damp(this.pos[2],ladder.pos[2],9,dt);
      this.pos[1]=clamp(this.pos[1]+climb*dt,0,ladder.yMax+.04);
      if(this.pos[1]>=ladder.yMax+.02&&climb>0){this.pos[2]=ladder.pos[2]-1.12;this.onLadder=false;this.ladderCooldown=.7;}
      if(this.isDown("Space")||this.touchJump||strafe!==0){this.onLadder=false;this.ladderCooldown=.6;this.vel=[strafe*3,4,2];this.touchJump=false;}
      else if(this.onLadder)return;
    }else this.onLadder=false;
    const sin=Math.sin(this.yaw),cos=Math.cos(this.yaw);
    const wx=-sin*forward+cos*strafe,wz=-cos*forward-sin*strafe,length=Math.hypot(wx,wz);
    const speed=(crouch?t.crouchSpeed:this.sprinting?t.sprintSpeed:t.walkSpeed)*this.mods.speed*this.weaponSpeed;
    if(this.grounded){
      this.vel[0]=damp(this.vel[0],length?wx/length*speed:0,t.accel,dt);
      this.vel[2]=damp(this.vel[2],length?wz/length*speed:0,t.accel,dt);
      if(this.isDown("Space")||this.touchJump){this.vel[1]=t.jumpSpeed;this.grounded=false;this.touchJump=false;}
    }else if(length){this.vel[0]+=wx/length*t.airAccel*dt;this.vel[2]+=wz/length*t.airAccel*dt;}
    this.vel[1]=Math.max(-45,this.vel[1]-t.gravity*dt);
    const falling=this.vel[1];
    const result=moveAndCollide(this.pos,[t.radius,0,t.radius],crouch?1.25:t.height,this.vel,dt,this.solids);
    if(result.grounded&&!this.grounded&&falling<-6)this.landDip=Math.min(.3,-falling*.012);
    this.grounded=result.grounded;
    this.bobPhase+=dt*(this.grounded?Math.hypot(this.vel[0],this.vel[2])*2:0);
    this.landDip=damp(this.landDip,0,8,dt);
    if(this.timeSinceDamage>t.regenDelay)this.health=Math.min(100,this.health+t.regenRate*this.mods.regen*dt);
    this.pos[0]=clamp(this.pos[0],-WORLD.outer+1,WORLD.outer-1);this.pos[2]=clamp(this.pos[2],WORLD.north+1,WORLD.south-1);
  }
}
