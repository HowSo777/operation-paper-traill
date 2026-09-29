import {io} from "socket.io-client";
import assert from "node:assert/strict";
const url=process.env.TEST_SOCKET_URL||"http://127.0.0.1:4000";
const options={transports:["websocket"],reconnection:false,timeout:5000};
function event(socket,name,predicate=()=>true){
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{socket.off(name,handler);reject(new Error(`Timed out waiting for ${name}`));},6000);
    function handler(value){if(!predicate(value))return;clearTimeout(timeout);socket.off(name,handler);resolve(value);}
    socket.on(name,handler);
  });
}
const a=io(url,{...options,autoConnect:false}),b=io(url,{...options,autoConnect:false});
try{
  const aInit=event(a,"init"),bInit=event(b,"init");a.connect();b.connect();
  const [one,two]=await Promise.all([aInit,bInit]);
  assert.notEqual(one.id,two.id);
  a.emit("hello",{name:"TEST-RIDER"});b.emit("hello",{name:"TEST-SPOTTER"});
  const bikeSnapshot=event(b,"snapshot",data=>data.players.some(p=>p.id===one.id&&p.riding&&p.pos[2]===130));
  a.emit("move",{pos:[6,.02,130],yaw:Math.PI,pitch:0,hp:100,alive:true,moving:true,riding:true,weapon:"smg",protected:false});
  const update=await bikeSnapshot;
  const rider=update.players.find(p=>p.id===one.id);
  assert.equal(rider.weapon,"smg");assert.equal(rider.name,"TEST-RIDER");assert.equal(rider.riding,true);
  console.log("SYNC: rider position beyond the compound and equipped MP5 received by second client");
  const rideShot=event(b,"playerShot");a.emit("shot",{origin:[6,1.7,130],dir:[0,0,1]});
  assert.equal((await rideShot).id,one.id);
  a.emit("move",{pos:[6,.02,130],yaw:Math.PI,pitch:0,hp:100,alive:true,moving:false,riding:false,weapon:"rifle",protected:false});
  await new Promise(r=>setTimeout(r,180));
  const shot=event(b,"playerShot");a.emit("shot",{origin:[6,1.7,130],dir:[0,0,1]});
  assert.equal((await shot).id,one.id);
  console.log("COMBAT: gunfight fire relayed while riding and on foot");
  const left=event(b,"playerLeft",payload=>payload.id===one.id);a.disconnect();assert.equal((await left).id,one.id);
  console.log("PASS: two-player Socket.io smoke test");
}finally{a.disconnect();b.disconnect();}
