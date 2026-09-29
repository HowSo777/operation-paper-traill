import test from "node:test";
import assert from "node:assert/strict";
import { TEAM_CAPACITY, TEAM_SCORE_LIMIT } from "../src/game/mapData";
import { ARENA_BOXES, ARENA_TEAM_SPAWNS } from "../src/game/arena";
import { aabbOverlap, actorBox, boxToAabb } from "../src/game/collision";
import { chooseTeam, freshScore, spawnFor, winningTeam } from "../src/game/teams";
import { getServerHudSnapshot } from "../src/game/store";

test("auto balance fills a 5v5 room evenly", () => {
  let blue = 0;
  let red = 0;
  const assigned: string[] = [];
  for (let i = 0; i < TEAM_CAPACITY * 2; i++) {
    const team = chooseTeam(blue, red);
    assigned.push(team);
    if (team === "blue") blue++;
    if (team === "red") red++;
    assert.ok(Math.abs(blue - red) <= 1, "teams never differ by more than one while filling");
  }
  assert.equal(blue, TEAM_CAPACITY);
  assert.equal(red, TEAM_CAPACITY);
  assert.equal(chooseTeam(blue, red), "spectator");
  assert.deepEqual(assigned.slice(0, 4), ["blue", "red", "blue", "red"]);
});

test("all ten faction spawns are distinct and inside the arena", () => {
  const all = [...ARENA_TEAM_SPAWNS.blue, ...ARENA_TEAM_SPAWNS.red];
  assert.equal(all.length, 10);
  assert.equal(new Set(all.map(p => `${p[0]},${p[2]}`)).size, 10);
  for (let i = 0; i < TEAM_CAPACITY; i++) {
    assert.deepEqual(spawnFor("blue", i), ARENA_TEAM_SPAWNS.blue[i]);
    assert.deepEqual(spawnFor("red", i), ARENA_TEAM_SPAWNS.red[i]);
  }
  for (const spawn of all) {
    const actor = actorBox(spawn, [.34, 0, .34], 1.8);
    for (const box of ARENA_BOXES) {
      if (box.kind === "ground") continue;
      assert.equal(aabbOverlap(actor, boxToAabb(box)), false, `spawn ${spawn} clears ${box.kind} at ${box.pos}`);
    }
    assert.ok(Math.abs(spawn[0]) < 45 && Math.abs(spawn[2]) < 37, `spawn ${spawn} is visibly inside Ironworks`);
  }
});

test("team elimination round ends only at score limit", () => {
  const score = freshScore();
  assert.equal(score.limit, TEAM_SCORE_LIMIT);
  assert.equal(winningTeam(score), null);
  score.blue = TEAM_SCORE_LIMIT - 1;
  assert.equal(winningTeam(score), null);
  score.blue += 1;
  assert.equal(winningTeam(score), "blue");
  score.blue = 0;
  score.red = TEAM_SCORE_LIMIT;
  assert.equal(winningTeam(score), "red");
});

test("scoreboard starts hidden until Tab is held", () => {
  assert.equal(getServerHudSnapshot().scoreboardOpen, false);
});
