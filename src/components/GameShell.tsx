"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Engine } from "@/game/engine";
import { getServerHudSnapshot, hudStore } from "@/game/store";
import { loadPersistedLoadout, savePersistedLoadout } from "@/game/progression";
import type { DifficultyId, GameMode, Loadout } from "@/game/types";
import { Hud } from "./Hud";
import { LoadoutMenu, type MenuSettings } from "./LoadoutMenu";
import { MobileControls } from "./MobileControls";

function fallbackSocketUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const socketUrlRef = useRef("");
  const [mode, setMode] = useState<GameMode>("rescue");
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState(false);
  const [callsign, setCallsign] = useState("");
  const [loadout, setLoadout] = useState<Loadout>({ primary: "rifle", perk: "scout" });
  const [difficulty, setDifficulty] = useState<DifficultyId>("regular");
  const [settings, setSettings] = useState<MenuSettings>({ sensitivity: 0.002, volume: 70, muted: false, invertY: false, quality: "high" });
  const state = useSyncExternalStore(
    hudStore.subscribe,
    hudStore.getSnapshot,
    getServerHudSnapshot,
  );

  // Build the world immediately so the loadout menu sits over the live scene.
  // Pointer lock still requires a real click, so deploy starts play.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1800);

    async function boot() {
      let socketUrl = fallbackSocketUrl();
      try {
        const response = await fetch("/api/game-config", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok) {
          const config = (await response.json()) as { socketUrl?: string };
          if (typeof config.socketUrl === "string") {
            socketUrl = config.socketUrl.trim() || fallbackSocketUrl();
          }
        }
      } catch {
        // The local game is playable even when the multiplayer port is offline.
      } finally {
        window.clearTimeout(timeout);
      }

      if (cancelled || !canvas) return;
      try {
        const chosenMode: GameMode = new URLSearchParams(window.location.search).get("mode") === "deathmatch" ? "deathmatch" : "rescue";
        socketUrlRef.current = socketUrl;
        setMode(chosenMode);
        const persisted = loadPersistedLoadout();
        const storedPrimary = (["rifle", "smg", "shotgun", "sniper"] as const).includes(persisted.primary as Loadout["primary"]) ? persisted.primary as Loadout["primary"] : "rifle";
        const storedPerk = (["medic", "scout", "armor"] as const).includes(persisted.perk as Loadout["perk"]) ? persisted.perk as Loadout["perk"] : "scout";
        const storedDifficulty: DifficultyId = persisted.difficulty === "recruit" || persisted.difficulty === "veteran" ? persisted.difficulty : "regular";
        const name = persisted.callsign || `AGENT-${String(Math.floor(Math.random() * 900) + 100)}`;
        const engine = new Engine({
          canvas,
          playerName: name,
          socketUrl,
          mode: chosenMode,
          loadout: { primary: storedPrimary, perk: storedPerk },
          difficulty: storedDifficulty,
        });
        engineRef.current = engine;
        hudStore.set({ status: "menu", mode: chosenMode, mission: "briefing", playerName: name });
        engine.start();
        const snap = hudStore.getSnapshot();
        setLoadout(snap.loadout);
        setDifficulty(snap.difficulty);
        setSettings(snap.settings);
        setCallsign(name);
        setReady(true);
        void engine.refreshLeaderboard();
      } catch (error) {
        console.error("Could not start the game", error);
        setBootError(true);
      }
    }

    void boot();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) engineRef.current?.pause();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const play = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const current = hudStore.getSnapshot();
    if (current.status === "paused") engine.resume();
    else if (current.status === "playing" && !current.pointerLocked) engine.lock();
  }, []);

  const chooseMode = useCallback((nextMode: GameMode) => {
    if (hudStore.getSnapshot().status !== "menu" || nextMode === mode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    engineRef.current?.dispose();
    engineRef.current = null;
    try {
      const engine = new Engine({
        canvas, playerName: callsign || "OPERATIVE",
        socketUrl: socketUrlRef.current || fallbackSocketUrl(),
        mode: nextMode, loadout, difficulty,
      });
      engineRef.current = engine;
      engine.start();
      hudStore.set({ status: "menu", mode: nextMode, mission: "briefing" });
      setMode(nextMode);
      const url = new URL(window.location.href);
      if (nextMode === "deathmatch") url.searchParams.set("mode", "deathmatch");
      else url.searchParams.delete("mode");
      window.history.replaceState(null, "", url.toString());
      if (nextMode === "rescue") void engine.refreshLeaderboard();
    } catch (error) {
      console.error("Could not switch game mode", error);
      setBootError(true);
    }
  }, [mode, callsign, loadout, difficulty]);

  const deploy = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const name = callsign.trim() || `AGENT-${String(Math.floor(Math.random() * 900) + 100)}`;
    savePersistedLoadout({ primary: loadout.primary, perk: loadout.perk, difficulty, callsign: name });
    engine.setPlayerName(name);
    engine.applyLoadout(loadout, difficulty);
    engine.lock();
  }, [callsign, loadout, difficulty]);

  const onSettings = useCallback((next: MenuSettings) => {
    setSettings(next);
    engineRef.current?.applySettings(next);
  }, []);

  const replay = useCallback(() => {
    engineRef.current?.restart();
  }, []);

  const toMenu = useCallback(() => {
    engineRef.current?.toMenu();
  }, []);

  const run = state.lastRun;
  const bests = state.bests;

  return (
    <main className="game-shell fixed inset-0 h-[100dvh] w-screen overflow-hidden">
      <canvas
        ref={canvasRef}
        onClick={play}
        aria-label="Full-screen first-person game. Click to play."
        className="absolute inset-0 block h-full w-full touch-none"
      />

      {ready && <Hud state={state} />}
      <MobileControls engine={engineRef.current} active={ready && state.status === "playing"} />

      {ready && state.status === "menu" && (
        <LoadoutMenu
          mode={mode}
          onMode={chooseMode}
          callsign={callsign}
          onCallsign={setCallsign}
          loadout={loadout}
          onLoadout={setLoadout}
          difficulty={difficulty}
          onDifficulty={setDifficulty}
          settings={settings}
          onSettings={onSettings}
          bests={bests}
          leaderboard={state.leaderboard}
          onDeploy={deploy}
        />
      )}

      {ready && state.status === "paused" && (
        <div className="menu-overlay dim">
          <div className="pause-panel">
            <p className="menu-eyebrow">PAUSED</p>
            <h2>Take five, operative</h2>
            <div className="pause-stats">
              <div><span>SCORE</span><b>{state.score}</b></div>
              <div><span>KILLS</span><b>{state.kills}</b></div>
              <div><span>TIME</span><b>{formatTime(state.missionTimeMs)}</b></div>
            </div>
            {state.contracts.length > 0 && (
              <ul className="pause-contracts">
                {state.contracts.map(c => (
                  <li key={c.id} className={c.done ? "done" : ""}>
                    {c.done ? "✓" : `${c.progress}/${c.target}`} · {c.title}
                  </li>
                ))}
              </ul>
            )}
            <div className="pause-buttons">
              <button type="button" className="deploy-btn" onClick={() => engineRef.current?.resume()}>Resume</button>
              <button type="button" onClick={() => engineRef.current?.restart()}>Restart run</button>
              <button type="button" onClick={toMenu}>Change loadout</button>
            </div>
            <label className="setting-row">
              <span>Sensitivity</span>
              <input type="range" min={0.0005} max={0.006} step={0.0001} value={settings.sensitivity}
                onChange={e => onSettings({ ...settings, sensitivity: Number(e.target.value) })} />
            </label>
            <div className="setting-toggles">
              <button type="button" className={settings.muted ? "on" : ""} onClick={() => onSettings({ ...settings, muted: !settings.muted })}>Mute{settings.muted ? "d" : ""}</button>
              <button type="button" className={settings.invertY ? "on" : ""} onClick={() => onSettings({ ...settings, invertY: !settings.invertY })}>Invert Y</button>
            </div>
          </div>
        </div>
      )}

      {ready && (state.status === "dead" || state.status === "complete") && run && (
        <div className="menu-overlay dim">
          <div className="debrief-panel">
            <p className="menu-eyebrow">{state.status === "complete" ? "EXTRACTION COMPLETE" : "MISSION FAILED"}</p>
            <div className="debrief-title">
              <h2>{state.status === "complete" ? "Hostage extracted" : "Eliminated"}</h2>
              <span className={`grade grade-${run.grade}`}>{run.grade}</span>
            </div>
            <div className="debrief-grid">
              <div><span>TIME</span><b>{formatTime(run.timeMs)}</b>{bests.bestTimeMs === run.timeMs && run.result === "accomplished" && <em>NEW BEST</em>}</div>
              <div><span>KILLS</span><b>{run.kills}</b>{bests.bestKills === run.kills && run.kills > 0 && <em>NEW BEST</em>}</div>
              <div><span>ACCURACY</span><b>{run.accuracy}%</b></div>
              <div><span>SCORE</span><b>{run.score}</b>{bests.bestScore === run.score && run.score > 0 && <em>NEW BEST</em>}</div>
              <div><span>HEADSHOTS</span><b>{run.headshots}</b></div>
              <div><span>CONTRACTS</span><b>{run.contractsDone}/3</b></div>
            </div>
            <p className="debrief-xp">+{run.xpGained} XP · Level {state.level} · {run.difficulty.toUpperCase()}</p>
            {state.leaderboard.length > 0 && (
              <ol className="menu-board">
                {state.leaderboard.slice(0, 5).map((entry, i) => (
                  <li key={entry.id}>
                    <span>#{i + 1} {entry.playerName}</span>
                    <span>{entry.score} PTS · {formatTime(entry.timeMs)}</span>
                  </li>
                ))}
              </ol>
            )}
            <div className="pause-buttons">
              <button type="button" className="deploy-btn" onClick={replay}>
                {state.status === "complete" ? "Play again" : "Respawn"}
              </button>
              <button type="button" onClick={toMenu}>Change loadout</button>
            </div>
          </div>
        </div>
      )}

      {bootError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white p-6 font-mono text-sm text-black">
          This browser could not start the 3D game. Please enable WebGL and reload.
        </div>
      )}
    </main>
  );
}
