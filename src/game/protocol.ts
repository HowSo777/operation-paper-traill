import type { GameMode, TeamId, TeamOrSpectator, Vec3, WeaponKind } from "./types";

export type TeamScorePayload = { blue: number; red: number; limit: number; round: number; ended: boolean };
export type MovePayload = {
  pos: Vec3; yaw: number; pitch: number; hp: number; alive: boolean;
  moving: boolean; riding?: boolean; weapon?: WeaponKind; protected?: boolean;
};
export type PlayerSnapshot = MovePayload & {
  id: string; name: string; kills: number; deaths: number; team: TeamOrSpectator; mode: GameMode;
};
export type MatchPayload = TeamScorePayload & {
  mode: GameMode; bluePlayers: number; redPlayers: number; capacity: number; selfTeam?: TeamOrSpectator;
};
export type ServerToClientEvents = {
  init: (payload: { id: string; players: PlayerSnapshot[]; tick: number; match: MatchPayload }) => void;
  snapshot: (payload: { players: PlayerSnapshot[]; tick: number; match: MatchPayload }) => void;
  playerJoined: (player: PlayerSnapshot) => void;
  playerLeft: (payload: { id: string }) => void;
  playerShot: (payload: { id: string; origin: Vec3; dir: Vec3 }) => void;
  playerHurt: (payload: { id: string; hp: number; byId: string; damage: number }) => void;
  playerDied: (payload: {
    victimId: string; killerId: string; killerName: string; victimName: string;
    team: TeamOrSpectator; score: TeamScorePayload;
  }) => void;
  matchUpdate: (payload: MatchPayload) => void;
  roundEnded: (payload: { winner: TeamId; score: TeamScorePayload }) => void;
  missionRecorded: (payload: { name: string; timeMs: number; kills: number; score?: number }) => void;
};
export type ClientToServerEvents = {
  hello: (payload: { name: string }) => void;
  move: (payload: MovePayload) => void;
  shot: (payload: { origin: Vec3; dir: Vec3 }) => void;
  hit: (payload: { targetId: string; damage: number }) => void;
  missionComplete: (payload: { name: string; timeMs: number; kills: number; accuracy: number; score?: number }) => void;
};

export const ROOM_RESCUE = "rescue";
export const ROOM_DEATHMATCH = "deathmatch";
/** Backwards-compatible alias for existing rescue clients. */
export const ROOM = ROOM_RESCUE;
