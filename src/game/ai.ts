/** Shared, render-independent patrol / burst-fire / delayed sniper AI. */
import { angleDelta, clamp, damp, hasLineOfSight, moveAndCollide, rayAabb, raycastBoxes } from "./collision";
import type { AABB, EnemyKind, Vec3 } from "./types";
export type GuardMode="patrol"|"alert"|"engage"|"search";
export type EnemyState={
  id:string;kind:EnemyKind;pos:Vec3;yaw:number;pitch:number;hp:number;maxHp:number;alive:boolean;deathTime:number;
  legPhase:number;speed:number;mode:GuardMode;patrol:Vec3[];patrolIndex:number;reaction:number;fireCooldown:number;
  burstLeft:number;burstPause:number;strafeDir:number;strafeTimer:number;lastKnown:Vec3|null;searchTimer:number;
  aimProgress:number;sniperCooldown:number;hasLos:boolean;muzzleFlash:number;justFired:boolean;
};
export type AiWorld={blockers:AABB[];solids?:AABB[];playerPos:Vec3;playerAlive:boolean};
export type AiEvents={onGuardShot:(e:EnemyState,origin:Vec3,dir:Vec3)=>void;onSniperShot:(e:EnemyState,origin:Vec3,dir:Vec3)=>void;onNoise:(pos:Vec3,radius:number)=>void};
type AiTuning={guard:{damage:number;fireInterval:number;burstShots:number;burstPause:[number,number];reaction:number;range:number;speed:number;accuracy:number};sniper:{damage:number;aimTime:number;cooldown:number;range:number}};
export function createEnemy(id:string,kind:EnemyKind,pos:Vec3,yaw:number,patrol:Vec3[],hp:number):EnemyState {
  return{id,kind,pos:[...pos],yaw,pitch:0,hp,maxHp:hp,alive:true,deathTime:0,legPhase:0,speed:0,mode:"patrol",patrol:patrol.map(p=>[...p]),patrolIndex:0,reaction:0,fireCooldown:0,burstLeft:0,burstPause:0,strafeDir:1,strafeTimer:2,lastKnown:null,searchTimer:0,aimProgress:0,sniperCooldown:1,hasLos:false,muzzleFlash:0,justFired:false};
}
const eye=(e:EnemyState):Vec3=>[e.pos[0],e.pos[1]+1.55,e.pos[2]];
const targetEye=(p:Vec3):Vec3=>[p[0],p[1]+1.1,p[2]];
function aim(e:EnemyState,target:Vec3,spread:number):Vec3 {
  const origin=eye(e),to=targetEye(target),length=Math.hypot(to[0]-origin[0],to[1]-origin[1],to[2]-origin[2])||1;
  const dir:Vec3=to.map((v,i)=>(v-origin[i])/length+(Math.random()-.5)*spread*2) as Vec3;
  const norm=Math.hypot(...dir)||1;return dir.map(v=>v/norm) as Vec3;
}
function face(e:EnemyState,to:Vec3,dt:number):void {
  e.yaw+=angleDelta(e.yaw,Math.atan2(-(to[0]-e.pos[0]),-(to[2]-e.pos[2])))*(1-Math.exp(-8*dt));
}
function walk(e:EnemyState,target:Vec3,speed:number,dt:number,solids:AABB[]):void {
  const dx=target[0]-e.pos[0],dz=target[2]-e.pos[2],distance=Math.hypot(dx,dz);
  if(distance<.05){e.speed=0;return;}
  const velocity:Vec3=[dx/distance*speed,0,dz/distance*speed];
  const result=moveAndCollide(e.pos,[.32,0,.32],1.78,velocity,dt,solids);
  e.speed=Math.hypot(velocity[0],velocity[2]);e.legPhase+=e.speed*dt*3;
  if(result.hitWall&&e.mode==="patrol")e.patrolIndex++;
  face(e,target,dt);
  // No guard can walk into the protected staging compound.
  e.pos[2]=Math.min(e.pos[2],49);
}
export function updateEnemy(e:EnemyState,world:AiWorld,events:AiEvents,dt:number,t:AiTuning):void {
  e.justFired=false;e.muzzleFlash=Math.max(0,e.muzzleFlash-dt*12);e.speed=0;
  if(!e.alive){e.deathTime=Math.min(1,e.deathTime+dt*2);return;}
  const player=world.playerPos,dist=Math.hypot(player[0]-e.pos[0],player[2]-e.pos[2]);
  const range=e.kind==="sniper"?t.sniper.range:t.guard.range;
  const canSee=world.playerAlive&&dist<range&&hasLineOfSight(eye(e),targetEye(player),world.blockers);
  e.hasLos=canSee;
  if(e.kind==="sniper"){
    e.sniperCooldown=Math.max(0,e.sniperCooldown-dt);
    if(canSee){
      face(e,player,dt);e.pitch=damp(e.pitch,Math.atan2(player[1]+1.1-(e.pos[1]+1.55),Math.max(.1,dist)),5,dt);
      if(e.sniperCooldown===0){
        e.aimProgress+=dt/t.sniper.aimTime;
        if(e.aimProgress>=1){e.justFired=true;e.muzzleFlash=1;e.aimProgress=0;e.sniperCooldown=t.sniper.cooldown;events.onSniperShot(e,eye(e),aim(e,player,.01));}
      }
    }else e.aimProgress=0;
    return;
  }
  e.fireCooldown=Math.max(0,e.fireCooldown-dt);e.burstPause=Math.max(0,e.burstPause-dt);
  const solids=world.solids??world.blockers;
  if(!world.playerAlive){e.mode="patrol";e.reaction=0;e.lastKnown=null;e.burstLeft=0;}
  if(canSee){
    e.reaction+=dt;e.lastKnown=[...player];face(e,player,dt);
    e.mode=e.reaction<t.guard.reaction?"alert":"engage";
    if(e.mode==="engage"){
      e.strafeTimer-=dt;if(e.strafeTimer<=0){e.strafeDir*=-1;e.strafeTimer=2.6;}
      if(dist>17)walk(e,player,t.guard.speed*.55,dt,solids);
      else if(dist>5){
        const target:Vec3=[e.pos[0]+Math.cos(e.yaw)*e.strafeDir*2,e.pos[1],e.pos[2]-Math.sin(e.yaw)*e.strafeDir*2];
        const yaw=e.yaw;walk(e,target,t.guard.speed*.48,dt,solids);e.yaw=yaw;
      }
      if(e.burstLeft===0&&e.burstPause===0)e.burstLeft=t.guard.burstShots;
      if(e.burstLeft>0&&e.fireCooldown===0){
        e.justFired=true;e.muzzleFlash=1;e.burstLeft--;e.fireCooldown=t.guard.fireInterval;
        events.onGuardShot(e,eye(e),aim(e,player,t.guard.accuracy));
        if(e.burstLeft===0)e.burstPause=t.guard.burstPause[0]+Math.random()*(t.guard.burstPause[1]-t.guard.burstPause[0]);
      }
    }
  }else{
    e.reaction=0;e.burstLeft=0;
    if(e.mode==="engage"||e.mode==="alert"){e.mode="search";e.searchTimer=4;}
    if(e.mode==="search"){
      e.searchTimer-=dt;
      if(e.lastKnown&&distance(e.pos,e.lastKnown)>1)walk(e,e.lastKnown,t.guard.speed*.65,dt,solids);
      if(e.searchTimer<=0)e.mode="patrol";
    }else if(e.patrol.length){
      const point=e.patrol[e.patrolIndex%e.patrol.length];
      if(distance(point,e.pos)<.7)e.patrolIndex++;
      else walk(e,point,t.guard.speed*.6,dt,solids);
    }
  }
}
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
export function enemyBulletHitsPlayer(origin:Vec3,dir:Vec3,pos:Vec3,blockers:AABB[],radius=.34,height=1.8):{hit:boolean;distance:number} {
  const box:AABB={min:[pos[0]-radius,pos[1],pos[2]-radius],max:[pos[0]+radius,pos[1]+height,pos[2]+radius]};
  const hit=rayAabb(origin,dir,box,160);
  if(!hit)return{hit:false,distance:160};
  const obstruction=raycastBoxes(origin,dir,blockers,Math.max(0,hit.t-.02));
  return{hit:!obstruction,distance:hit.t};
}
export function noiseRadiusFor(kind:EnemyKind):number{return kind==="sniper"?26:18;}
export {clamp};
