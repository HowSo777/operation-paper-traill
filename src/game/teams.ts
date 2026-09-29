/** Shared, testable 5v5 team rules for the separate Ironworks mode. */
import { TEAM_CAPACITY, TEAM_COLORS, TEAM_SCORE_LIMIT } from "./mapData";
import { ARENA_TEAM_SPAWNS, ARENA_YAW } from "./arena";
import type { TeamId, TeamOrSpectator, Vec3 } from "./types";

export const TEAM_META: Record<TeamId, { name: string; short: string; color: number; spawn: Vec3; yaw: number }> = {
  blue: { name: "BLUE", short: "BLU", color: TEAM_COLORS.blue, spawn: ARENA_TEAM_SPAWNS.blue[0], yaw: ARENA_YAW.blue },
  red: { name: "RED", short: "RED", color: TEAM_COLORS.red, spawn: ARENA_TEAM_SPAWNS.red[0], yaw: ARENA_YAW.red },
};
export type TeamScore = { blue: number; red: number; limit: number; round: number; ended: boolean };
export const freshScore = (): TeamScore => ({ blue: 0, red: 0, limit: TEAM_SCORE_LIMIT, round: 1, ended: false });

export function chooseTeam(blue: number, red: number): TeamOrSpectator {
  if (blue >= TEAM_CAPACITY && red >= TEAM_CAPACITY) return "spectator";
  if (blue >= TEAM_CAPACITY) return "red";
  if (red >= TEAM_CAPACITY) return "blue";
  return blue <= red ? "blue" : "red";
}
export function spawnFor(team: TeamId, index = 0): Vec3 {
  const points = ARENA_TEAM_SPAWNS[team];
  return [...points[index % points.length]] as Vec3;
}
export function winningTeam(score: TeamScore): TeamId | null {
  if (score.blue >= score.limit) return "blue";
  if (score.red >= score.limit) return "red";
  return null;
}
