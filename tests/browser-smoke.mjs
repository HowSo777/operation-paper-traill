import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

await mkdir("artifacts",{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const context=await browser.newContext({viewport:{width:1536,height:864},deviceScaleFactor:1});
const page=await context.newPage();
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
page.on("console",m=>{if(m.type()==="error"&&!m.text().includes("favicon"))errors.push(m.text());});
try{
  await page.goto(process.env.BASE_URL||"http://127.0.0.1:3000",{waitUntil:"networkidle",timeout:30000});
  await page.waitForSelector(".game-hud",{timeout:20000});
  // Inspect the mounted engine through React's test-time fibre references.
  // Nothing is exposed on window by the production application itself.
  await page.evaluate(()=>{
    const canvas=document.querySelector("canvas");
    let fiber=canvas[Object.keys(canvas).find(key=>key.startsWith("__reactFiber"))];
    while(fiber){
      let hook=fiber.memoizedState;
      while(hook){
        const value=hook.memoizedState?.current;
        if(value&&typeof value.start==="function"&&value.player){window.__testEngine=value;return;}
        hook=hook.next;
      }
      fiber=fiber.return;
    }
    throw new Error("Could not find mounted engine for integration checks");
  });
  await page.waitForTimeout(1300);
  await page.screenshot({path:"artifacts/spawn.png"});
  console.log("INITIAL",await page.evaluate(()=>({text:document.body.innerText,position:window.__testEngine.player.pos,drawCalls:window.__testEngine.renderer.info.render.calls})));
  await page.getByRole("button",{name:/deploy/i}).click();
  await page.waitForFunction(()=>document.pointerLockElement!==null);
  await page.waitForTimeout(500);
  assert.ok(await page.evaluate(()=>window.__testEngine.weapon.inventory.has("pistol")),"pistol sidearm holstered");
  await page.waitForSelector(".minimap-wrap");
  await page.keyboard.press("KeyE");
  await page.waitForFunction(()=>window.__testEngine.weapon.kind==="smg");
  console.log("PICKUP: MP5 equipped");
  await page.evaluate(()=>{
    const e=window.__testEngine;
    e.weapon.inventory.set("sniper",{ammo:10,reserve:40});
    e.weapon.switch("sniper");
    e.rightDown=true;
  });
  await page.waitForSelector(".scope-aperture");
  await page.waitForFunction(()=>window.__testEngine.camera.fov<35,{timeout:5000});
  const scopeState=await page.evaluate(()=>({
    scopeVisible:!!document.querySelector(".scope-aperture"),
    gunVisible:window.__testEngine.weapon.group.visible,
    fov:window.__testEngine.camera.fov,
  }));
  assert.equal(scopeState.scopeVisible,true);
  assert.equal(scopeState.gunVisible,false,"sniper gun is hidden behind the optic");
  assert.ok(scopeState.fov<35,"sniper optic is zoomed");
  await page.evaluate(()=>{window.__testEngine.rightDown=false;window.__testEngine.weapon.switch("smg");});
  await page.mouse.down();
  await page.waitForFunction(()=>window.__testEngine.weapon.ammo<30,{},{timeout:15000});
  await page.mouse.up();
  assert.ok(await page.evaluate(()=>window.__testEngine.weapon.ammo<30),"weapon fires");
  await page.keyboard.press("r");
  await page.waitForFunction(()=>!window.__testEngine.weapon.reloading&&window.__testEngine.weapon.ammo===30,{},{timeout:20000});
  console.log("COMBAT: fire and reload work");
  await page.evaluate(()=>window.__testEngine.onPlayerHit(200,[0,0,0]));
  assert.equal(await page.evaluate(()=>window.__testEngine.player.health),100,"safe zone prevents damage");
  console.log("SAFE SPAWN: damage blocked");
  await page.keyboard.press("1");
  assert.equal(await page.evaluate(()=>window.__testEngine.weapon.kind),"rifle");
  await page.evaluate(()=>{
    const e=window.__testEngine;e.player.pos=[e.bike.pos[0]+1.6,.02,e.bike.pos[2]];e.player.yaw=Math.PI/2;e.player.pitch=-.04;e.player.vel=[0,0,0];
  });
  await page.waitForTimeout(400);await page.keyboard.press("e");
  await page.waitForFunction(()=>window.__testEngine.bike.riding);
  await page.keyboard.down("w");
  await page.waitForFunction(()=>window.__testEngine.bike.speed>6&&window.__testEngine.bike.pos[2]>58,{},{timeout:15000});
  await page.keyboard.up("w");
  const riding=await page.evaluate(()=>({speed:window.__testEngine.bike.speed,pos:window.__testEngine.bike.pos,rifleVisible:window.__testEngine.weapon.group.visible,cockpitVisible:window.__testEngine.cockpit.visible}));
  assert.ok(riding.speed>1&&riding.pos[2]>57);assert.equal(riding.rifleVisible,true,"gun stays ready for the ride gunfight");assert.equal(riding.cockpitVisible,true);
  await page.waitForSelector(".bike-reticle");
  await page.screenshot({path:"artifacts/riding.png"});
  console.log("BIKE RIDING",riding);
  // Bike fight sequence: pursuit riders appear and the weapon works from the saddle.
  await page.waitForFunction(()=>window.__testEngine.pursuit.spawned>0,{},{timeout:15000});
  await page.keyboard.down("w");await page.waitForTimeout(900);await page.keyboard.up("w");
  const ammoBefore=await page.evaluate(()=>window.__testEngine.weapon.ammo);
  await page.mouse.down();
  await page.waitForFunction(before=>window.__testEngine.weapon.ammo<before,ammoBefore,{timeout:15000});
  await page.mouse.up();
  console.log("BIKE GUNFIGHT:",await page.evaluate(()=>({riders:window.__testEngine.pursuit.alive,spawned:window.__testEngine.pursuit.spawned})));
  await page.keyboard.down("Space");
  await page.waitForFunction(()=>Math.abs(window.__testEngine.bike.speed)<1,{},{timeout:15000});
  await page.keyboard.up("Space");await page.keyboard.press("KeyE");
  await page.waitForFunction(()=>!window.__testEngine.bike.riding);
  console.log("BIKE: brake and dismount work");
  // Set up the end-to-end objective interaction without spending the test
  // walking the entire compound. All interactions still go through E.
  // Inside the buried shelter's north chamber, facing the hostage. The spot is
  // clear of the blast baffle so collision never catapults the player upward.
  await page.evaluate(()=>{const e=window.__testEngine;e.player.pos=[-58,.02,-30.4];e.player.vel=[0,0,0];e.player.yaw=0;e.player.pitch=0;e.protection=8;e.update(.02);});
  await page.waitForTimeout(300);await page.keyboard.press("KeyE");
  await page.waitForFunction(()=>window.__testEngine.rescued);
  console.log("HOSTAGE: rescued by interaction");
  await page.evaluate(()=>{const e=window.__testEngine;e.bike.reset();e.player.pos=[e.bike.pos[0]+1.6,.02,e.bike.pos[2]];e.player.yaw=Math.PI/2;e.hostagePos=[e.bike.pos[0]-.7,.02,e.bike.pos[2]+1];e.escortTrail=[];});
  await page.waitForTimeout(300);await page.keyboard.press("KeyE");
  await page.waitForFunction(()=>window.__testEngine.bike.riding);
  let recorded=null;
  let recordCount=0;
  await page.route("**/api/leaderboard",async route=>{
    if(route.request().method()==="POST"){recorded=route.request().postDataJSON();recordCount++;}
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true})});
  });
  await page.evaluate(()=>{
    const e=window.__testEngine;
    const gates=e.world.checkpoints.map(g=>[g.position.x,g.position.z]);
    let prev=[e.bike.pos[0],e.bike.pos[2]];
    for(const [x,z] of gates){
      const dx=x-prev[0],dz=z-prev[1],length=Math.hypot(dx,dz)||1;
      e.bike.pos=[x-dx/length*.05,.02,z-dz/length*.05];
      e.bike.yaw=Math.atan2(-dx/length,-dz/length);e.player.yaw=e.bike.yaw;e.bike.speed=3;
      e.update(.02);prev=[x,z];
    }
    // Pump the finish timer deterministically: wall-clock rAF is too slow
    // under software rendering to cover the 1.2s extraction hold.
    for(let i=0;i<80;i++)e.update(.04);
  });
  await page.waitForSelector("button:has-text('Play again')",{timeout:10000});
  await page.waitForTimeout(300);
  assert.equal(recorded?.result,"accomplished");
  assert.equal(recordCount,1);
  assert.equal(await page.evaluate(()=>window.__testEngine.bike.checkpoint),8);
  console.log("MISSION: all gates crossed; accomplishment recorded once");
  await page.getByRole("button",{name:"Play again"}).click();
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>window.__testEngine.rescued),false);
  assert.equal(await page.evaluate(()=>window.__testEngine.weapon.kind),"rifle");
  console.log("RESTART: safe spawn and inventory reset");
  await page.keyboard.press("Escape");
  await page.setViewportSize({width:720,height:540});await page.waitForTimeout(400);
  const size=await page.getByLabel("Full-screen first-person game. Click to play.").boundingBox();assert.equal(size.width,720);assert.equal(size.height,540);
  console.log("RESIZE: canvas fills viewport");
  assert.deepEqual(errors,[]);
  console.log("PASS: browser interactions; no runtime errors");
}finally{await browser.close();}
