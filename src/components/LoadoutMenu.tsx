"use client";

import { useState } from "react";
import { DIFFICULTIES, LOADOUTS, PERKS, WEAPONS } from "@/game/armament";
import type { Bests } from "@/game/progression";
import type { LeaderboardEntry } from "@/game/store";
import type { DifficultyId, GameMode, Loadout, PrimaryKind } from "@/game/types";

export type MenuSettings = { sensitivity: number; volume: number; muted: boolean; invertY: boolean; quality: "high" | "low" };

type Props = {
  mode: GameMode;
  onMode: (mode: GameMode) => void;
  callsign: string;
  onCallsign: (v: string) => void;
  loadout: Loadout;
  onLoadout: (v: Loadout) => void;
  difficulty: DifficultyId;
  onDifficulty: (v: DifficultyId) => void;
  settings: MenuSettings;
  onSettings: (v: MenuSettings) => void;
  bests: Bests;
  leaderboard: LeaderboardEntry[];
  onDeploy: () => void;
};

function Bars({ stats }: { stats: { damage: number; rpm: number; range: number; control: number } }) {
  const rows: [string, number][] = [["DMG", stats.damage], ["RPM", stats.rpm], ["RNG", stats.range], ["CTL", stats.control]];
  return (
    <div className="stat-bars">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <i>
            {[1, 2, 3, 4, 5].map(n => (
              <b key={n} className={n <= value ? "on" : ""} />
            ))}
          </i>
        </div>
      ))}
    </div>
  );
}

function formatTime(ms: number): string {
  if (!ms) return "--:--";
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function LoadoutMenu(props: Props) {
  const { loadout } = props;
  const [copied, setCopied] = useState<string | null>(null);
  const share = async (mode: GameMode) => {
    const url = new URL(window.location.href);
    if (mode === "deathmatch") url.searchParams.set("mode", "deathmatch");
    else url.searchParams.delete("mode");
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(mode);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      window.prompt("Copy this invite link", url.toString());
    }
  };
  return (
    <div className="menu-overlay">
      <div className="menu-panel">
        <div className="menu-header">
          <div>
            <p className="menu-eyebrow">OPERATION // PAPER TRAIL</p>
            <h1>Choose your operation</h1>
            <p className="menu-sub">Two separate games. Pick your mission before you deploy.</p>
          </div>
          <div className="menu-bests">
            <div><span>BEST SCORE</span><b>{props.bests.bestScore || "—"}</b></div>
            <div><span>BEST TIME</span><b>{formatTime(props.bests.bestTimeMs)}</b></div>
            <div><span>RUNS</span><b>{props.bests.runs}</b></div>
          </div>
        </div>

        <section className="mode-tabs" aria-label="Choose a game mode" role="tablist">
          <button type="button" role="tab" className={`mode-tab rescue${props.mode === "rescue" ? " selected" : ""}`} onClick={() => props.onMode("rescue")} aria-selected={props.mode === "rescue"}>
            <span>01</span><strong>HOSTAGE RESCUE</strong><em>CO-OP</em>
          </button>
          <button type="button" role="tab" className={`mode-tab deathmatch${props.mode === "deathmatch" ? " selected" : ""}`} onClick={() => props.onMode("deathmatch")} aria-selected={props.mode === "deathmatch"}>
            <span>02</span><strong>TEAM DEATHMATCH</strong><em>5v5 PvP</em>
          </button>
        </section>
        <div className={`mode-summary ${props.mode}`} aria-live="polite">
          {props.mode === "rescue" ? <><b>INFILTRATE · RESCUE · EXFIL</b><span>Fight AI guards and tower snipers, find the captive in the buried bunker, then survive the motorcycle pursuit.</span><i>NPC GUARDS · HIDDEN HOSTAGE · EXTRACTION RUN</i></> : <><b>5 BLUE VS 5 RED · FIRST TO 30</b><span>Real players only on Ironworks. Hold angles, use mirrored lanes and elevated decks, and redeploy straight back into the fight.</span><i>DEDICATED ROOM · FRIENDLY FIRE OFF · NO RESCUE OBJECTIVES</i></>}
        </div>
        <div className="mode-share-row">
          <span>INVITE YOUR SQUAD</span>
          <button type="button" onClick={() => void share("rescue")}>{copied === "rescue" ? "✓ Rescue link copied" : "Copy Rescue link"}</button>
          <button type="button" onClick={() => void share("deathmatch")}>{copied === "deathmatch" ? "✓ 5v5 invite copied" : "Copy 5v5 invite"}</button>
        </div>

        <div className="menu-grid">
          <section>
            <h2>Primary weapon <em>P9 sidearm always holstered</em></h2>
            <div className="card-row">
              {LOADOUTS.map(card => {
                const spec = WEAPONS[card.id];
                const selected = loadout.primary === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={`pick-card${selected ? " selected" : ""}`}
                    onClick={() => props.onLoadout({ ...loadout, primary: card.id as PrimaryKind })}
                  >
                    <b>{spec.name}</b>
                    <span className="pick-tag">{card.tagline}</span>
                    <span className="pick-blurb">{spec.blurb}</span>
                    <Bars stats={card.stats} />
                  </button>
                );
              })}
            </div>

            {props.mode === "rescue" ? <>
              <h2>Rescue perk</h2>
              <div className="card-row three">
                {PERKS.map(perk => (
                  <button key={perk.id} type="button" className={`pick-card${loadout.perk === perk.id ? " selected" : ""}`} onClick={() => props.onLoadout({ ...loadout, perk: perk.id })}>
                    <b>{perk.name}</b><span className="pick-blurb">{perk.desc}</span>
                  </button>
                ))}
              </div>
              <h2>Rescue difficulty</h2>
              <div className="card-row three">
                {DIFFICULTIES.map(d => (
                  <button key={d.id} type="button" className={`pick-card${props.difficulty === d.id ? " selected" : ""}`} onClick={() => props.onDifficulty(d.id)}>
                    <b>{d.name}</b><span className="pick-blurb">{d.desc}</span>
                  </button>
                ))}
              </div>
            </> : <div className="competitive-note">
              <b>FAIR PLAY</b> · No AI, hostage, vehicle, difficulty modifiers, armor perks or health regeneration. Your loadout and aim decide the fight.
            </div>}
          </section>

          <aside>
            <h2>Operative</h2>
            <input
              value={props.callsign}
              onChange={e => props.onCallsign(e.target.value.toUpperCase().replace(/[^\w \-]/g, "").slice(0, 14))}
              placeholder="CALLSIGN"
              maxLength={14}
              className="callsign-input"
              aria-label="Callsign"
            />
            <h2>Settings</h2>
            <label className="setting-row">
              <span>Sensitivity</span>
              <input
                type="range" min={0.0005} max={0.006} step={0.0001}
                value={props.settings.sensitivity}
                onChange={e => props.onSettings({ ...props.settings, sensitivity: Number(e.target.value) })}
              />
            </label>
            <label className="setting-row">
              <span>Volume</span>
              <input
                type="range" min={0} max={100} step={1}
                value={props.settings.volume}
                onChange={e => props.onSettings({ ...props.settings, volume: Number(e.target.value) })}
              />
            </label>
            <div className="setting-toggles">
              <button type="button" className={props.settings.muted ? "on" : ""} onClick={() => props.onSettings({ ...props.settings, muted: !props.settings.muted })}>Mute{props.settings.muted ? "d" : ""}</button>
              <button type="button" className={props.settings.invertY ? "on" : ""} onClick={() => props.onSettings({ ...props.settings, invertY: !props.settings.invertY })}>Invert Y</button>
              <button type="button" className={props.settings.quality === "low" ? "on" : ""} onClick={() => props.onSettings({ ...props.settings, quality: props.settings.quality === "low" ? "high" : "low" })}>Low FX</button>
            </div>
            {props.mode === "rescue" ? <>
              <h2>Top exfils</h2>
              {props.leaderboard.length === 0 ? <p className="menu-muted">No recorded runs yet. Be the first legend.</p> : (
                <ol className="menu-board">{props.leaderboard.slice(0, 5).map((run, i) => (
                  <li key={run.id}><span>#{i + 1} {run.playerName}</span><span>{run.score} PTS · {formatTime(run.timeMs)}</span></li>
                ))}</ol>
              )}
            </> : <p className="menu-muted">Invite friends with this page link. Teams fill automatically, up to five real players each.</p>}
            <button type="button" className="deploy-btn" onClick={props.onDeploy}>
              {props.mode === "deathmatch" ? "ENTER 5v5 ARENA →" : "DEPLOY FOR RESCUE →"}
            </button>
            <p className="menu-muted">WASD move · Mouse look · LMB fire · RMB aim · E interact · R reload · 1–5 weapons · M mute</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
