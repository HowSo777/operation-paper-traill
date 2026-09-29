import test from "node:test";
import assert from "node:assert/strict";
import { actorBox, aabbOverlap, angleDelta, hasLineOfSight, moveAndCollide } from "../src/game/collision";
import { ALL_ENEMY_SPAWNS, BIKE, CHECKPOINTS, HOSTAGE, MAP_BOXES, PLAYER_SPAWN, PURSUIT, ROAD_POINTS, TANKS, TUNING, WORLD, getBlockerAabbs, getShotBlockers, getSolidAabbs, isSafeZone } from "../src/game/mapData";
import { Pursuit, makeRoadPath } from "../src/game/pursuit";
import { PICKUP_SPAWNS, WEAPONS, shotSpread, weaponMoveMultiplier } from "../src/game/armament";
import { refillInventory } from "../src/game/weapons";
import { makeGun } from "../src/game/gunModels";
import * as THREE from "three";
import { CONTRACTS, gradeFor, levelForXp, newContracts, streakText, xpForLevel } from "../src/game/progression";
import { BikeController, type BikeInput } from "../src/game/vehicle";
import { createEnemy, enemyBulletHitsPlayer, updateEnemy, type AiEvents } from "../src/game/ai";
import type { Vec3 } from "../src/game/types";
import { boxToAabb } from "../src/game/collision";
import { BARRELS, BUILDINGS, CATWALK_BOXES, EXTRA_LADDERS, RAIL_BOXES, WRECK_BOXES } from "../src/game/mapData";

test("the fighting grounds offer distinct combat spaces",()=>{
  // 1. Container maze: tight CQB lanes with stacked lookouts in the east yard.
  const maze=MAP_BOXES.filter(b=>b.kind==="container"&&b.pos[0]>=52&&b.pos[0]<=78&&b.pos[2]>=12&&b.pos[2]<=48);
  assert.ok(maze.length>=14,"container maze has lanes and stacks");
  assert.ok(maze.some(b=>b.pos[1]>4),"second-storey lookout over the lanes");
  // 2. Rail yard: long horizontal cover to break sightlines.
  assert.ok(RAIL_BOXES.length>=4,"rail yard wagons and flatcar deck");
  // 3. Elevated catwalk, climbable to deck level, plus warehouse roof access.
  assert.ok(CATWALK_BOXES.some(b=>b.kind==="platform"&&Math.abs(b.pos[1]-5.075)<.01),"catwalk deck sits at 5.2m");
  const cat=EXTRA_LADDERS.find(l=>l.id==="catwalk-ladder");
  assert.ok(cat&&Math.abs(cat.yMax-5.2)<.01,"ladder climbs onto the catwalk deck");
  const roof=EXTRA_LADDERS.find(l=>l.id==="warehouse-roof-ladder");
  assert.ok(roof&&roof.yMax>=7.5,"warehouse roof is reachable");
  // 4. Vehicle wrecks and cover at several heights, not one repeated box.
  assert.equal(WRECK_BOXES.length,2,"two vehicle wrecks as cover");
  const heights=new Set(MAP_BOXES.filter(b=>b.kind==="wall").map(b=>b.size[1]));
  assert.ok(heights.size>=4,"cover spans several heights");
  // New geometry never buries an existing building (no phantom overlap).
  for(const b of [...maze,...RAIL_BOXES,...CATWALK_BOXES,...WRECK_BOXES])
    for(const w of BUILDINGS)
      assert.ok(!aabbOverlap(boxToAabb(b),boxToAabb(w)),`new zone overlaps a building at ${b.pos}`);
  assert.ok(ALL_ENEMY_SPAWNS.length>=19,"the new zones are patrolled");
});

test("explosive barrels are visible, opaque and in the fight",()=>{
  assert.equal(BARRELS.length,6);
  for(const b of BARRELS){
    const box=MAP_BOXES.find(m=>Math.abs(m.pos[0]-b.pos[0])<.01&&Math.abs(m.pos[2]-b.pos[2])<.01&&Math.abs(m.pos[1]-b.height/2)<.01);
    assert.ok(box,`barrel ${b.id} has a collider`);
    assert.ok(box!.kind!=="fence"&&box!.kind!=="boundary","a barrel stops bullets");
    // The drum is never buried inside other geometry.
    for(const m of MAP_BOXES){
      if(m===box||m.kind==="ground")continue;
      assert.ok(!aabbOverlap(boxToAabb(box!),boxToAabb(m)),`barrel ${b.id} overlaps ${m.kind} at ${m.pos}`);
    }
  }
  const shots=getShotBlockers();
  assert.ok(!hasLineOfSight([63,.5,16],[63,.5,26],shots),"a barrel is solid cover in the maze");
  assert.ok(!hasLineOfSight([-11.5,.5,20],[-11.5,.5,31],shots),"and beside the yard wreck");
});

const noInput:BikeInput={throttle:false,brake:false,left:false,right:false,handbrake:false};

test("spawn is protected and outside solid geometry",()=>{
  assert.ok(isSafeZone(PLAYER_SPAWN));
  const body=actorBox(PLAYER_SPAWN,[.34,0,.34],1.8);
  assert.ok(getSolidAabbs().every(box=>!aabbOverlap(body,box)));
  for(const enemy of ALL_ENEMY_SPAWNS)assert.ok(Math.hypot(enemy.pos[0]-PLAYER_SPAWN[0],enemy.pos[2]-PLAYER_SPAWN[2])>30);
});

test("southern gate is actually open and walkable",()=>{
  const pos:Vec3=[0,.02,56],velocity:Vec3=[0,0,-5];
  for(let i=0;i<100;i++)moveAndCollide(pos,[.34,0,.34],1.8,velocity,.02,getSolidAabbs());
  assert.ok(pos[2]<48);assert.ok(!isSafeZone(pos));
});

test("the compound and escape road are twice the original size",()=>{
  assert.equal(WORLD.half,130);assert.equal(WORLD.south,470);
  assert.ok(ROAD_POINTS.at(-1)![2]>440);
  assert.equal(CHECKPOINTS.length,8);
  assert.ok(ALL_ENEMY_SPAWNS.length>=16);
});

test("the escape road starts under the bike and runs due south first",()=>{
  assert.equal(ROAD_POINTS[0][0],BIKE.pos[0]);
  assert.equal(ROAD_POINTS[0][2],BIKE.pos[2]);
  assert.equal(CHECKPOINTS[0][0],0);
  assert.ok(CHECKPOINTS[0][2]>BIKE.pos[2]+20);
  for(const gate of CHECKPOINTS){
    const onRoad=ROAD_POINTS.some(point=>Math.hypot(point[0]-gate[0],point[2]-gate[2])<0.05);
    assert.ok(onRoad,`checkpoint ${gate} sits on the painted centreline`);
  }
});

test("the staging MP5 pickup is reachable with clear line of sight",()=>{
  const pickup=PICKUP_SPAWNS.find(p=>p.id==="staging-mp5")!;
  assert.ok(Math.hypot(pickup.pos[0]-PLAYER_SPAWN[0],pickup.pos[2]-PLAYER_SPAWN[2])<2.8);
  assert.ok(hasLineOfSight([PLAYER_SPAWN[0],1.72,PLAYER_SPAWN[2]],[pickup.pos[0],pickup.pos[1]+.12,pickup.pos[2]],getBlockerAabbs()));
  assert.ok(WEAPONS.smg.interval<WEAPONS.rifle.interval);
  assert.ok(WEAPONS.sniper.damage>WEAPONS.rifle.damage);
});

test("the visible staging motorcycle is protected and clear of crates",()=>{
  assert.ok(isSafeZone(BIKE.pos));
  const body=actorBox(BIKE.pos,[.5,0,1],1.45);
  assert.ok(getSolidAabbs().every(box=>!aabbOverlap(body,box)));
});

test("bike accelerates along the road and advances first checkpoint",()=>{
  const bike=new BikeController(getSolidAabbs());bike.mount();
  const gate=CHECKPOINTS[0];
  for(let i=0;i<170;i++){
    const turn=angleDelta(bike.yaw,Math.atan2(-(gate[0]-bike.pos[0]),-(gate[2]-bike.pos[2])));
    bike.update(1/60,{...noInput,throttle:true,left:turn>.03,right:turn<-.03});
  }
  assert.ok(bike.speed>10);assert.ok(bike.pos[2]>BIKE.pos[2]+20);
  assert.equal(bike.checkpoint,1);
});

test("bike cannot dismount at speed, but can after braking",()=>{
  const bike=new BikeController(getSolidAabbs());bike.mount();
  for(let i=0;i<100;i++)bike.update(1/60,{...noInput,throttle:true});
  assert.equal(bike.dismount(),false);
  for(let i=0;i<90;i++)bike.update(1/60,{...noInput,handbrake:true});
  assert.equal(bike.dismount(),true);assert.equal(bike.riding,false);
});

test("steering changes heading and bike reset restores safe start",()=>{
  const bike=new BikeController(getSolidAabbs());bike.mount();
  for(let i=0;i<50;i++)bike.update(1/60,{...noInput,throttle:true});
  const yaw=bike.yaw;
  for(let i=0;i<30;i++)bike.update(1/60,{...noInput,throttle:true,left:true});
  assert.ok(bike.yaw>yaw);bike.reset();assert.deepEqual(bike.pos,BIKE.pos);assert.equal(bike.checkpoint,0);
});

test("checkpoints must be visited in order",()=>{
  const bike=new BikeController(getSolidAabbs());bike.mount();
  bike.pos=[...CHECKPOINTS[3]];bike.speed=5;bike.update(.016,noInput);assert.equal(bike.checkpoint,0);
  for(let i=0;i<CHECKPOINTS.length;i++){
    bike.pos=[...CHECKPOINTS[i]];bike.pos[1]=.02;bike.speed=3;
    const event=bike.update(.016,noInput);assert.ok(event.checkpointPassed);assert.equal(bike.checkpoint,i+1);
  }
});

test("motorcycle substeps prevent passing through thin walls",()=>{
  const bike=new BikeController([{min:[-5,0,4],max:[5,3,4.12]}]);
  bike.pos=[0,.02,0];bike.yaw=Math.PI;bike.mount();bike.speed=24;
  for(let i=0;i<30;i++)bike.update(.04,{...noInput,throttle:true});
  assert.ok(bike.pos[2]<4);assert.ok(bike.speed<15);
});

test("AI does not shoot a protected player",()=>{
  let shots=0;const events:AiEvents={onGuardShot:()=>shots++,onSniperShot:()=>shots++,onNoise:()=>{}};
  const guard=createEnemy("test","guard",[0,.02,0],0,[],100);
  for(let i=0;i<600;i++)updateEnemy(guard,{blockers:[],playerPos:[0,.02,10],playerAlive:false},events,1/60,TUNING);
  assert.equal(shots,0);
});

test("snipers aim before firing and dead enemies cannot repeat shots",()=>{
  let shots=0;const events:AiEvents={onGuardShot:()=>shots++,onSniperShot:()=>shots++,onNoise:()=>{}};
  const sniper=createEnemy("test","sniper",[0,10,0],0,[],100);
  const world={blockers:[],playerPos:[0,.02,20] as Vec3,playerAlive:true};
  for(let i=0;i<100;i++)updateEnemy(sniper,world,events,1/60,TUNING);
  assert.equal(shots,0);
  for(let i=0;i<150;i++)updateEnemy(sniper,world,events,1/60,TUNING);
  assert.equal(shots,1);sniper.alive=false;sniper.justFired=true;
  updateEnemy(sniper,world,events,1/60,TUNING);assert.equal(sniper.justFired,false);
});

test("the full eight-gate escape road is drivable with steering and braking",()=>{
  const bike=new BikeController(getSolidAabbs());bike.mount();let waypoint=1;
  for(let frame=0;frame<12000&&bike.checkpoint<CHECKPOINTS.length;frame++){
    let target=ROAD_POINTS[waypoint];
    if(Math.hypot(target[0]-bike.pos[0],target[2]-bike.pos[2])<4.5&&waypoint<ROAD_POINTS.length-1)target=ROAD_POINTS[++waypoint];
    const desired=Math.atan2(-(target[0]-bike.pos[0]),-(target[2]-bike.pos[2]));
    const turn=angleDelta(bike.yaw,desired);
    bike.update(1/60,{throttle:bike.speed<10,brake:bike.speed>12,left:turn>.025,right:turn<-.025,handbrake:false});
  }
  assert.equal(bike.checkpoint,CHECKPOINTS.length);
});

test("pursuing riders close from behind along the road and can be shot down",()=>{
  const path=makeRoadPath(ROAD_POINTS);const pursuit=new Pursuit(path);let shots=0;
  pursuit.spawn(80);assert.equal(pursuit.alive,1);
  const events={onShot:()=>shots++,onKilled:()=>{}};
  const rider=pursuit.entries[0];const start=rider.distance;
  for(let frame=0;frame<600;frame++)pursuit.update(1/60,[10,0,120],true,path,events);
  assert.ok(shots>0,"riders open fire once in range");
  assert.ok(rider.distance>start,"riders chase down the 400m road");
  const hit=pursuit.raycast([rider.pos[0],rider.pos[1]+1.2,rider.pos[2]+8],[0,0,-1],30);
  assert.ok(hit);assert.equal(hit!.id,rider.id);
  assert.equal(pursuit.damage(rider.id,40)?.killed,false);
  assert.equal(pursuit.damage(rider.id,80)?.killed,true);
});

test("pursuit respects its wave limits over the whole ride",()=>{
  const path=makeRoadPath(ROAD_POINTS);const pursuit=new Pursuit(path);
  const events={onShot:()=>{},onKilled:()=>{}};
  for(let frame=0;frame<3000;frame++)pursuit.update(1/60,[0,0,200],false,path,events);
  assert.ok(pursuit.alive<=PURSUIT.maxAlive);assert.ok(pursuit.spawned<=PURSUIT.maxTotal);
});

test("shotgun and pistol specs are sane and pickups exist",()=>{
  assert.equal(WEAPONS.shotgun.pellets,8);
  assert.equal(WEAPONS.shotgun.auto,false);
  assert.equal(WEAPONS.pistol.auto,false);
  assert.ok(WEAPONS.shotgun.damage*WEAPONS.shotgun.pellets>WEAPONS.rifle.damage);
  assert.ok(PICKUP_SPAWNS.some(p=>p.kind==="shotgun"));
});

test("progression levels, streaks and contracts behave",()=>{
  assert.ok(xpForLevel(1)>0);
  assert.ok(xpForLevel(5)>xpForLevel(1));
  assert.equal(levelForXp(0).level,1);
  const mid=xpForLevel(1)+10;
  assert.equal(levelForXp(mid).level,2);
  assert.equal(streakText(2),"DOUBLE KILL");
  assert.equal(streakText(3),"TRIPLE KILL");
  assert.equal(streakText(5),"RAMPAGE ×5");
  assert.equal(streakText(1),null);
  assert.equal(CONTRACTS.length,3);
  const contracts=newContracts();
  assert.deepEqual(Object.keys(contracts).sort(),["ghost","headhunter","roadwarrior"]);
  assert.equal(gradeFor(3000),"S");
  assert.equal(gradeFor(100),"C");
});

test("death reloads every owned weapon without deleting pickups",()=>{
  const inventory=new Map([
    ["rifle" as const,{ammo:2,reserve:7}],
    ["sniper" as const,{ammo:0,reserve:3}],
    ["pistol" as const,{ammo:1,reserve:0}],
  ]);
  refillInventory(inventory);
  assert.equal(inventory.size,3);
  for(const [kind,state] of inventory){
    assert.equal(state.ammo,WEAPONS[kind].magSize,`${kind} magazine full`);
    assert.equal(state.reserve,WEAPONS[kind].reserve,`${kind} reserve restored`);
  }
});

test("sniper slows movement and hip fire is deliberately inaccurate",()=>{
  assert.equal(weaponMoveMultiplier("rifle",false),1);
  assert.equal(weaponMoveMultiplier("sniper",false),.78);
  assert.equal(weaponMoveMultiplier("sniper",true),.55);
  const scoped=shotSpread("sniper",{aiming:true,moving:true,sprinting:false,grounded:false});
  const hip=shotSpread("sniper",{aiming:false,moving:false,sprinting:false,grounded:true});
  const running=shotSpread("sniper",{aiming:false,moving:true,sprinting:true,grounded:false});
  assert.ok(hip>scoped*500,"hip-fire cone is hundreds of times wider than scope");
  assert.ok(running>hip*2,"running sniper hip fire is worse again");
});

test("every gun has a recognisably different silhouette and color set",()=>{
  const data=new Map<string,{size:THREE.Vector3;colors:Set<number>}>();
  for(const kind of ["rifle","smg","sniper","shotgun","pistol"] as const){
    const gun=makeGun(kind,true);
    gun.updateMatrixWorld(true);
    const size=new THREE.Vector3();new THREE.Box3().setFromObject(gun).getSize(size);
    const colors=new Set<number>();
    gun.traverse(object=>{
      const material=(object as THREE.Mesh).material;
      for(const m of Array.isArray(material)?material:material?[material]:[]){
        const color=(m as THREE.MeshBasicMaterial).color;
        if(color)colors.add(color.getHex());
      }
    });
    data.set(kind,{size,colors});
  }
  assert.ok(data.get("sniper")!.size.z>data.get("smg")!.size.z*.75,"SVD is visibly longer");
  assert.ok(data.get("pistol")!.size.z<data.get("rifle")!.size.z*.45,"P9 is compact");
  assert.ok(data.get("shotgun")!.colors.has(0xb9362d),"M870 has red shell carrier");
  assert.ok(data.get("rifle")!.colors.has(0xb87943),"AK has wood furniture");
  assert.ok(data.get("sniper")!.colors.has(0x879777)||data.get("sniper")!.colors.has(0x718269),"SVD has olive furniture");
});

test("sniper is point-of-aim precise and drops a guard in one hit",()=>{
  assert.ok(WEAPONS.sniper.damage>=120,"body shot drops a 100hp guard");
  assert.ok(WEAPONS.sniper.damage>WEAPONS.rifle.damage);
  const scoped=shotSpread("sniper",{aiming:true,moving:true,sprinting:false,grounded:false});
  assert.ok(scoped<0.0001,"scoped cone is essentially a point");
  assert.ok(scoped*100<0.01,"sub-centimetre cone at 100m");
  // Movement must not spoil a held-breath scoped shot.
  assert.equal(scoped,shotSpread("sniper",{aiming:true,moving:false,sprinting:true,grounded:true}));
  assert.ok(shotSpread("sniper",{aiming:false,moving:true,sprinting:true,grounded:true})>scoped*10);
});

test("no invisible walls stop bullets",()=>{
  // Storage tanks: collider hugs the drawn shell (no phantom wall outside it,
  // no firing through the visible edge).
  for(const tank of TANKS){
    const box=MAP_BOXES.find(b=>Math.abs(b.pos[0]-tank.pos[0])<.01&&Math.abs(b.pos[2]-tank.pos[2])<.01&&Math.abs(b.size[1]-tank.height)<.01);
    assert.ok(box,`tank collider exists at ${tank.pos}`);
    const half=box!.size[0]/2;
    assert.ok(half>=tank.radius,"collider covers the visible shell");
    assert.ok(half<=tank.radius+0.3,"collider never exceeds the visible shell");
  }
  // Map-edge barriers are drawn chain-link and let fire pass through.
  const blockers=getBlockerAabbs();
  assert.ok(!blockers.some(b=>b.max[2]>460||b.min[2]<-145||b.min[0]<-140||b.max[0]>140),"map edge is not a bullet blocker");
  assert.ok(hasLineOfSight([0,1.4,455],[0,1.4,500],blockers),"shots leave the map instead of hitting nothing");
  assert.ok(hasLineOfSight([0,1.4,-140],[0,1.4,-180],blockers),"shots leave the north edge too");
  assert.ok(hasLineOfSight([-140,1.4,200],[-180,1.4,200],blockers));
  // A bullet is stopped only by opaque cover: chain-link and the map edge are
  // see-through, so a round flies straight through where your eyes can see.
  const shots=getShotBlockers();
  assert.ok(hasLineOfSight([8,1.4,-34],[2,1.4,-34],shots),"through the holding-pen chain-link");
  assert.ok(hasLineOfSight([0,1.4,455],[0,1.4,500],shots),"out past the map edge");
  assert.ok(!hasLineOfSight([-58,1.5,-45],[-58,1.5,-31.6],shots),"the shelter's earth berm stops it");
  assert.ok(!hasLineOfSight([0,0.5,0],[0,-2,0],shots),"the floor stops a downward round");
});

test("the hostage is hidden inside the buried shelter",()=>{
  const eye:Vec3=[HOSTAGE.pos[0],1.35,HOSTAGE.pos[2]];
  const blockers=getBlockerAabbs();
  assert.ok(!hasLineOfSight([-45,1.5,-30],eye,blockers),"east wall and berm block the view");
  assert.ok(!hasLineOfSight([-58,1.5,-45],eye,blockers),"north berm blocks the view");
  assert.ok(!hasLineOfSight([-75,1.5,-30],eye,blockers),"west berm blocks the view");
  assert.ok(!hasLineOfSight([-58,1.5,-15],eye,blockers),"even straight through the door the baffle hides her");
  assert.ok(!hasLineOfSight([-58,1.5,-27],eye,blockers),"south chamber has no view of her either");
  // Only the north chamber, reached by turning the corner, sees her.
  assert.ok(hasLineOfSight([-55,1.5,-33],eye,blockers),"inside her chamber she is visible");
  // She stands in clear interior, not inside geometry.
  assert.ok(getSolidAabbs().every(b=>!aabbOverlap(actorBox(HOSTAGE.pos,[.3,0,.3],1.8),b)));
  // And she is well away from the old open pen.
  assert.ok(Math.hypot(HOSTAGE.pos[0]-8,HOSTAGE.pos[2]+34)>20);
});

test("enemy bullets use exact ray hits and cannot damage through cover",()=>{
  const origin:Vec3=[0,1.1,10],dir:Vec3=[0,0,-1];
  assert.ok(enemyBulletHitsPlayer(origin,dir,[0,0,0],[]).hit);
  assert.ok(!enemyBulletHitsPlayer(origin,dir,[2,0,0],[]).hit);
  assert.ok(!enemyBulletHitsPlayer(origin,dir,[0,0,0],[{min:[-2,0,5],max:[2,3,6]}]).hit);
});
