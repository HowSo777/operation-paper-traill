/**
 * Socket.io client wrapper: joins the compound room, streams local player
 * state and exposes callbacks for remote players / combat events.
 */

import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  MatchPayload,
  PlayerSnapshot,
  ServerToClientEvents,
  TeamScorePayload,
} from "./protocol";
import { ROOM } from "./protocol";
import type { GameMode, Vec3 } from "./types";

export type NetHandlers = {
  onInit?: (selfId: string, players: PlayerSnapshot[], match: MatchPayload) => void;
  onSnapshot?: (players: PlayerSnapshot[], match: MatchPayload) => void;
  onPlayerJoined?: (player: PlayerSnapshot) => void;
  onPlayerLeft?: (payload: { id: string }) => void;
  onPlayerShot?: (id: string, origin: Vec3, dir: Vec3) => void;
  onPlayerHurt?: (id: string, hp: number, byId: string, damage: number) => void;
  onPlayerDied?: (payload: {
    victimId: string;
    killerId: string;
    killerName: string;
    victimName: string;
    team: import("./types").TeamOrSpectator;
    score: TeamScorePayload;
    headshot?: boolean;
  }) => void;
  onMatchUpdate?: (match: MatchPayload) => void;
  onRoundEnded?: (payload: { winner: import("./types").TeamId; score: TeamScorePayload }) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
};

export class Net {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  selfId: string | null = null;

  connect(url: string, name: string, handlers: NetHandlers, mode: GameMode = "rescue"): void {
    const targetUrl = url || (typeof window !== "undefined" ? window.location.origin : "");
    this.socket = io(targetUrl || undefined, {
      auth: { mode },
      transports: ["websocket", "polling"],
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
    const socket = this.socket;

    socket.on("connect", () => {
      handlers.onConnect?.();
      socket.emit("hello", { name });
    });
    socket.on("disconnect", () => handlers.onDisconnect?.());
    socket.on("init", ({ id, players, match }) => {
      this.selfId = id;
      handlers.onInit?.(id, players, match);
    });
    socket.on("snapshot", ({ players, match }) => handlers.onSnapshot?.(players, match));
    socket.on("playerJoined", (player) => handlers.onPlayerJoined?.(player));
    socket.on("playerLeft", ({ id }) => handlers.onPlayerLeft?.({ id }));
    socket.on("playerShot", ({ id, origin, dir }) =>
      handlers.onPlayerShot?.(id, origin, dir),
    );
    socket.on("playerHurt", ({ id, hp, byId, damage }) =>
      handlers.onPlayerHurt?.(id, hp, byId, damage),
    );
    socket.on("playerDied", (payload) => handlers.onPlayerDied?.(payload));
    socket.on("matchUpdate", (match) => handlers.onMatchUpdate?.(match));
    socket.on("roundEnded", (payload) => handlers.onRoundEnded?.(payload));
  }

  updateName(name: string): void {
    this.socket?.emit("hello", { name });
  }

  sendMove(payload: Parameters<ClientToServerEvents["move"]>[0]): void {
    this.socket?.emit("move", payload);
  }

  sendShot(origin: Vec3, dir: Vec3): void {
    this.socket?.emit("shot", { origin, dir });
  }

  sendHit(targetId: string, damage: number): void {
    this.socket?.emit("hit", { targetId, damage });
  }

  sendMissionComplete(payload: {
    name: string;
    timeMs: number;
    kills: number;
    accuracy: number;
    score?: number;
  }): void {
    this.socket?.emit("missionComplete", payload);
  }

  sendRematch(): void {
    this.socket?.emit("rematch");
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  dispose(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }
}

export { ROOM };
