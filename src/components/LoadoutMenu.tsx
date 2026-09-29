"use client";

import { useState } from "react";
import { DIFFICULTIES, LOADOUTS, PERKS, WEAPONS } from "@/game/armament";
import { type Bests, loadTotalXp } from "@/game/progression";
import { getRankForXp } from "@/game/ranks";
import { CrateModal } from "./CrateModal";
import type { LeaderboardEntry } from "@/game/store";
import type { DifficultyId, GameMode, Loadout, PrimaryKind, SecondaryKind } from "@/game/types";

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
  onRefreshSkin?: () => void;
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
  const [showCrates, setShowCrates] = useState(false);
  const rankInfo = getRankForXp(loadTotalXp());

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
            <p className="menu-sub">Tactical multiplayer FPS. Pick your loadout and unbox skins before deploying.</p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Competitive Rank Badge */}
            <div
              className="flex items-center gap-3 bg-neutral-900 border px-3.5 py-2 rounded-xl shadow-lg"
              style={{ borderColor: rankInfo.rank.badgeColor }}
            >
              <div
                className="w-10 h-10 rounded-full border-2 flex items-center justify-center font-black font-mono text-xs shadow-md"
                style={{
                  borderColor: rankInfo.rank.badgeColor,
                  color: rankInfo.rank.badgeColor,
                  backgroundColor: `${rankInfo.rank.badgeColor}22`,
                }}
              >
                {rankInfo.rank.division}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-black tracking-wider" style={{ color: rankInfo.rank.badgeColor }}>
                    {rankInfo.rank.name.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-amber-400">
                    {"★".repeat(rankInfo.rank.stars)}
                  </span>
                </div>
                <div className="w-24 bg-neutral-800 h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${rankInfo.progressPercent}%`,
                      backgroundColor: rankInfo.rank.badgeColor,
                    }}
                  />
                </div>
                <span className="text-[9px] text-neutral-400 font-mono mt-0.5">
                  {rankInfo.nextRank ? `${rankInfo.xpInRank} / ${rankInfo.xpInRank + rankInfo.xpNeededForNext} XP` : "MAX RANK"}
                </span>
              </div>
            </div>

            {/* CS:GO Crates & Skins Button */}
            <button
              type="button"
              onClick={() => setShowCrates(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black font-mono text-xs rounded-xl shadow-xl flex items-center gap-2 tracking-wider transition-transform active:scale-95 cursor-pointer"
            >
              <span className="text-base">📦</span>
              <span>CRATES & SKINS</span>
            </button>

            <div className="menu-bests">
              <div><span>BEST SCORE</span><b>{props.bests.bestScore || "—"}</b></div>
              <div><span>BEST TIME</span><b>{formatTime(props.bests.bestTimeMs)}</b></div>
              <div><span>RUNS</span><b>{props.bests.runs}</b></div>
            </div>
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
            <h2>Primary weapon <em>Choose your main armament</em></h2>
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

            <h2>Secondary sidearm <em>Reliable backup pistol</em></h2>
            <div className="card-row two">
              <button
                type="button"
                className={`pick-card${(loadout.secondary ?? "pistol") === "pistol" ? " selected" : ""}`}
                onClick={() => props.onLoadout({ ...loadout, secondary: "pistol" as SecondaryKind })}
              >
                <b>{WEAPONS.pistol.name}</b>
                <span className="pick-tag">9×19mm Para · 12 Rds</span>
                <span className="pick-blurb">{WEAPONS.pistol.blurb}</span>
              </button>
              <button
                type="button"
                className={`pick-card${loadout.secondary === "deagle" ? " selected" : ""}`}
                onClick={() => props.onLoadout({ ...loadout, secondary: "deagle" as SecondaryKind })}
              >
                <b>{WEAPONS.deagle.name}</b>
                <span className="pick-tag">.50 AE Hand Cannon · 72 DMG</span>
                <span className="pick-blurb">{WEAPONS.deagle.blurb}</span>
              </button>
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
              <b>FAIR PLAY</b> · No AI, hostage, vehicle, difficulty modifiers, armor perks or health regeneration. Your loadout, weapon skins and aim decide the fight.
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
            <p className="menu-muted">WASD move · Mouse look · LMB fire · RMB aim · E interact · R reload · 1–8 weapons · M mute</p>
          </aside>
        </div>
      </div>

      {/* CS:GO Crate Unboxing & Skin Arsenal Modal */}
      <CrateModal
        open={showCrates}
        onClose={() => setShowCrates(false)}
        onSkinEquipped={props.onRefreshSkin}
      />
    </div>
  );
}
