"use client";
import { useEffect, useState } from "react";
import type { HudState } from "@/game/store";
import { SLOT_ORDER, WEAPONS } from "@/game/armament";
import { getRankForXp } from "@/game/ranks";
import { getEquippedSkin } from "@/game/skins";
import { loadTotalXp } from "@/game/progression";
import { Minimap } from "./Minimap";

function Heart() { return <svg viewBox="0 0 48 44" aria-hidden="true"><path d="M24 41C20 37 2 26 2 13C2 1 17-3 24 8C31-3 46 1 46 13C46 26 28 37 24 41Z" fill="currentColor" /></svg>; }
function Magazine() { return <svg viewBox="0 0 37 57" aria-hidden="true"><path d="M4 3h18v8H5zM6 12h15c-1 15 2 27 11 34l-13 8C9 42 5 28 6 12Z" fill="currentColor" /><path d="M10 15c-1 14 3 27 12 36M16 15c-1 13 3 24 10 32" fill="none" stroke="white" strokeWidth="1.1" /><path d="m17 53 15-9 2 3-15 9Z" fill="white" stroke="currentColor" /></svg>; }
function Shield() { return <svg viewBox="0 0 20 23" aria-hidden="true"><path d="m10 2 8 3v6c0 5-8 10-8 10S2 16 2 11V5Z" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="m6 11 3 3 5-6" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>; }
function BikeReticle({ hit }: { hit: number }) {
  return <div className="bike-reticle" aria-hidden="true">
    <span className="reticle-v reticle-v-top" /><span className="reticle-v reticle-v-bottom" />
    <span className="reticle-h reticle-h-left" /><span className="reticle-h reticle-h-right" />
    <i />{hit > 0 && <b key={hit} className="reticle-hit" />}
  </div>;
}
function ScopeOverlay({ kind }: { kind?: string }) {
  const label = kind === "awp" ? "AWP MAGNUM · .338 LAPUA" : "SVD OPTIC · 7.62×54";
  return <div className="scope-overlay" aria-hidden="true">
    <div className="scope-aperture">
      <span className="scope-cross scope-cross-v" /><span className="scope-cross scope-cross-h" />
      <span className="scope-center" />
      <span className="scope-mil scope-mil-left" /><span className="scope-mil scope-mil-right" />
      <span className="scope-label">{label}</span>
    </div>
  </div>;
}

function KillEmblemBadge({ emblem }: { emblem: NonNullable<HudState["killEmblem"]> }) {
  return (
    <div className={`kill-emblem-container${emblem.headshot ? " headshot" : ""}`} key={emblem.id}>
      <div className="kill-emblem-crest">
        <svg viewBox="0 0 120 120" className="kill-emblem-svg" aria-hidden="true">
          <polygon
            points="60,6 114,60 60,114 6,60"
            fill="none"
            stroke={emblem.headshot ? "#ff1744" : "#e8a020"}
            strokeWidth="2.5"
            strokeDasharray="4 2"
          />
          <circle
            cx="60"
            cy="60"
            r="38"
            fill={emblem.headshot ? "rgba(193, 18, 31, 0.22)" : "rgba(232, 160, 32, 0.18)"}
            stroke={emblem.headshot ? "#ff1744" : "#e8a020"}
            strokeWidth="1.8"
          />
          <line x1="60" y1="12" x2="60" y2="28" stroke="#ffffff" strokeWidth="2" />
          <line x1="60" y1="92" x2="60" y2="108" stroke="#ffffff" strokeWidth="2" />
          <line x1="12" y1="60" x2="28" y2="60" stroke="#ffffff" strokeWidth="2" />
          <line x1="92" y1="60" x2="108" y2="60" stroke="#ffffff" strokeWidth="2" />

          {/* Wireframe Skull */}
          <path
            d="M44 48 C44 34 76 34 76 48 C76 56 72 62 68 64 L68 70 L52 70 L52 64 C48 62 44 56 44 48 Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="53" cy="50" r="3.5" fill={emblem.headshot ? "#ff1744" : "#e8a020"} />
          <circle cx="67" cy="50" r="3.5" fill={emblem.headshot ? "#ff1744" : "#e8a020"} />
          <polygon points="60,56 58,61 62,61" fill="#ffffff" />
          <line x1="56" y1="66" x2="56" y2="70" stroke="#ffffff" strokeWidth="1.5" />
          <line x1="60" y1="66" x2="60" y2="70" stroke="#ffffff" strokeWidth="1.5" />
          <line x1="64" y1="66" x2="64" y2="70" stroke="#ffffff" strokeWidth="1.5" />

          {/* Tactical wings */}
          <line x1="32" y1="34" x2="42" y2="44" stroke="#ffffff" strokeWidth="2" />
          <line x1="88" y1="34" x2="78" y2="44" stroke="#ffffff" strokeWidth="2" />
          <line x1="32" y1="86" x2="44" y2="74" stroke="#ffffff" strokeWidth="2" />
          <line x1="88" y1="86" x2="76" y2="74" stroke="#ffffff" strokeWidth="2" />
        </svg>
      </div>

      <div className="kill-emblem-text">
        <div className="kill-emblem-title">
          {emblem.headshot ? (
            <span className="badge-headshot">HEADSHOT</span>
          ) : (
            <span className="badge-kill">ELIMINATED</span>
          )}
          <span className="kill-emblem-xp">+{emblem.xp} XP</span>
        </div>
        <div className="kill-emblem-victim">{emblem.victim}</div>
        {emblem.streak > 1 && (
          <div className="kill-emblem-streak">
            {emblem.streak === 2 ? "DOUBLE KILL" : emblem.streak === 3 ? "TRIPLE KILL" : `STREAK x${emblem.streak}`}
          </div>
        )}
      </div>
    </div>
  );
}

export function Hud({ state }: { state: HudState }) {
  const [messageVisible, setMessageVisible] = useState(false);
  const [streakVisible, setStreakVisible] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [achievementVisible, setAchievementVisible] = useState(false);
  const [emblemVisible, setEmblemVisible] = useState(false);
  useEffect(() => {
    if (!state.message) return;
    const start = window.setTimeout(() => setMessageVisible(true), 0);
    const end = window.setTimeout(() => setMessageVisible(false), 2800);
    return () => { window.clearTimeout(start); window.clearTimeout(end); };
  }, [state.message, state.messageAt]);
  useEffect(() => {
    if (!state.streak) return;
    const start = window.setTimeout(() => setStreakVisible(true), 0);
    const end = window.setTimeout(() => setStreakVisible(false), 2400);
    return () => { window.clearTimeout(start); window.clearTimeout(end); };
  }, [state.streak]);
  useEffect(() => {
    if (!state.banner) return;
    const start = window.setTimeout(() => setBannerVisible(true), 0);
    const end = window.setTimeout(() => setBannerVisible(false), 1700);
    return () => { window.clearTimeout(start); window.clearTimeout(end); };
  }, [state.banner]);
  useEffect(() => {
    if (!state.achievement) return;
    const start = window.setTimeout(() => setAchievementVisible(true), 0);
    const end = window.setTimeout(() => setAchievementVisible(false), 3600);
    return () => { window.clearTimeout(start); window.clearTimeout(end); };
  }, [state.achievement]);
  useEffect(() => {
    if (!state.killEmblem) return;
    const start = window.setTimeout(() => setEmblemVisible(true), 0);
    const end = window.setTimeout(() => setEmblemVisible(false), 1900);
    return () => { window.clearTimeout(start); window.clearTimeout(end); };
  }, [state.killEmblem]);

  if (state.status === "menu") return <div className="game-hud menu-idle" />;

  const active = state.status === "playing" || state.status === "paused";
  const isSniperWeapon = state.weaponKind === "sniper" || state.weaponKind === "awp";
  const scoped = state.aiming && isSniperWeapon && !state.riding;
  const mags = Math.ceil(state.reserve / state.magazineSize);
  const lowHp = state.health <= 30 && state.status === "playing";
  const rankInfo = getRankForXp(loadTotalXp() + state.score);
  const equippedSkin = getEquippedSkin(state.weaponKind);

  return <div className={`game-hud${scoped ? " scoped" : ""}${lowHp ? " low-hp" : ""}`}>
    <div className="damage-shade" style={{ opacity: state.damageFlash }} />
    {lowHp && <div className="lowhp-pulse" />}
    {active && <>
      <div className="xp-wrap" aria-hidden="true">
        <span className="level-badge" style={{ borderColor: rankInfo.rank.badgeColor, color: rankInfo.rank.badgeColor }}>
          {rankInfo.rank.division} · {rankInfo.rank.name}
        </span>
        <span className="xp-bar"><i style={{ width: `${Math.round(state.xpProgress * 100)}%`, backgroundColor: rankInfo.rank.badgeColor }} /></span>
        <span className="score-chip">{state.score} PTS</span>
      </div>
      {state.mode === "deathmatch" && <>
        {!state.scoreboardOpen && (
          <div className="match-chip" aria-label={`Team score: blue ${state.match.blue}, red ${state.match.red}`}>
            <span className="chip-blue">BLU {state.match.blue}</span>
            <span className="chip-sep">·</span>
            <span className="chip-red">{state.match.red} RED</span>
            <kbd>TAB</kbd>
          </div>
        )}
        {state.scoreboardOpen && (
          <div className="scoreboard-overlay">
            <div className="scoreboard-panel">
              <div className="team-scoreboard" aria-label={`5v5 team score: blue ${state.match.blue}, red ${state.match.red}`}>
                <div className={`team-blue${state.team === "blue" ? " mine" : ""}`}><span>BLU</span><b>{state.match.blue}</b><em>{state.match.bluePlayers}/5</em></div>
                <p><span>5v5 TEAM DEATHMATCH</span><b>ROUND {state.match.round} · FIRST {state.match.limit}</b></p>
                <div className={`team-red${state.team === "red" ? " mine" : ""}`}><em>{state.match.redPlayers}/5</em><b>{state.match.red}</b><span>RED</span></div>
              </div>
              <div className="scoreboard-columns">
                <div className="team-roster roster-blue" aria-label="Blue team roster">
                  <header><b>BLUE SQUAD</b><span>{state.match.blue}/{state.match.limit}</span></header>
                  {state.roster.filter(p => p.team === "blue").sort((a,b) => b.kills-a.kills).map(p => <div key={p.id} className={`${p.name === state.playerName ? "self" : ""}${p.alive ? "" : " down"}`}><i/><span>{p.name}</span><em>{p.hp > 0 && p.alive ? `${p.hp}` : "OUT"}</em><b>{p.kills}</b></div>)}
                  {Array.from({length:Math.max(0,5-state.roster.filter(p=>p.team==="blue").length)},(_,i)=><div key={`blue-open-${i}`} className="empty-slot"><i/><span>OPEN SLOT</span><em>-</em><b>0</b></div>)}
                </div>
                <div className="team-roster roster-red" aria-label="Red team roster">
                  <header><b>RED SQUAD</b><span>{state.match.red}/{state.match.limit}</span></header>
                  {state.roster.filter(p => p.team === "red").sort((a,b) => b.kills-a.kills).map(p => <div key={p.id} className={`${p.name === state.playerName ? "self" : ""}${p.alive ? "" : " down"}`}><i/><span>{p.name}</span><em>{p.hp > 0 && p.alive ? `${p.hp}` : "OUT"}</em><b>{p.kills}</b></div>)}
                  {Array.from({length:Math.max(0,5-state.roster.filter(p=>p.team==="red").length)},(_,i)=><div key={`red-open-${i}`} className="empty-slot"><i/><span>OPEN SLOT</span><em>-</em><b>0</b></div>)}
                </div>
              </div>
            </div>
          </div>
        )}
      </>}
      {state.mode === "rescue" && state.scoreboardOpen && (
        <div className="scoreboard-overlay">
          <div className="scoreboard-panel">
            <div className="team-roster rescue-roster" aria-label="Operatives online">
              <header><b>OPERATIVES</b><span>{state.playersOnline} ONLINE</span></header>
              {state.roster.length === 0 && <div className="empty-slot"><i/><span>SOLO OPERATION</span><em>-</em><b>{state.kills}</b></div>}
              {[...state.roster].sort((a,b) => b.kills-a.kills).map(p => <div key={p.id} className={`${p.name === state.playerName ? "self" : ""}${p.alive ? "" : " down"}`}><i/><span>{p.name}</span><em>{p.alive ? `${p.hp} HP` : "OUT"}</em><b>{p.kills}</b></div>)}
            </div>
          </div>
        </div>
      )}
      <div className="mission-hint">
        <span className="objective-diamond" />
        <div><span className="mission-eyebrow">{state.mode === "deathmatch" ? "IRONWORKS / 5v5 ONLINE" : state.riding ? (state.hostageSecured ? "EXTRACTION ROUTE" : "FREE RIDE") : "OPERATION / PAPER TRAIL"}</span>
          <p>{state.objective}<span className="objective-distance">{state.objectiveDistance} m <span className="direction-arrow" style={{ transform: `rotate(${-state.objectiveBearing * 180 / Math.PI}deg)` }}>↑</span></span></p>
        </div>
      </div>
      {(state.safeZone || state.spawnProtection > 0) && !state.riding && <div className="safe-status"><Shield /><span>{state.safeZone ? "SAFE STAGING AREA" : `PROTECTED · ${state.spawnProtection}s`}</span></div>}
      {state.mode !== "deathmatch" && state.connected && state.playersOnline > 1 && <div className="player-status">{state.playersOnline} operatives</div>}
      {state.minimap && <Minimap map={state.minimap} />}
      {state.aiming && isSniperWeapon && !state.riding && <ScopeOverlay kind={state.weaponKind} />}
      {state.riding ? <BikeReticle hit={state.hitMarker} /> : !state.aiming && <div className="aim-dot" aria-hidden="true" />}
      {state.hitMarker > 0 && <span key={state.hitMarker} className="hit-marker" aria-hidden="true" />}
      {bannerVisible && state.banner && <div key={state.banner.id} className="kill-banner"><b>{state.banner.title}</b>{state.banner.sub && <span>{state.banner.sub}</span>}</div>}
      {streakVisible && state.streak && <div className="streak-banner">{state.streak.text}</div>}
      {emblemVisible && state.killEmblem && <KillEmblemBadge emblem={state.killEmblem} />}
      {state.sniperAim !== null && state.sniperAim > .25 && <div className="sniper-warning">Sniper sighted: find cover <span style={{ width: `${state.sniperAim * 100}%` }} /></div>}
      {state.status === "paused" ? <div className="play-hint"><span className="play-triangle" />Paused<span className="play-controls">Click resume or press Esc in the pause menu</span></div> : state.prompt && <div className="interaction-prompt"><kbd>{state.prompt.startsWith("E ·") ? "E" : "↑ ↓"}</kbd><span>{state.prompt.replace(/^E · /, "")}</span></div>}
      {state.riding && <div className="riding-controls"><kbd>W</kbd> accelerate <kbd>A</kbd><kbd>D</kbd> steer <kbd>Space</kbd> brake <kbd>LMB</kbd> fire <kbd>E</kbd> dismount <kbd>R</kbd> reset ride</div>}
      {state.riding && state.pursuers > 0 && <div className="pursuit-status"><span>{state.pursuers}</span><div>RIDER HOSTILES<em>shoot them off the road</em></div></div>}
      {state.respawnSeconds > 0 && <div className="redeploy-overlay"><div><span>{state.team === "red" ? "RED" : "BLUE"} SQUAD</span><b>REDEPLOYING</b><strong>{state.respawnSeconds}</strong><em>Hold the line · your team needs you</em></div></div>}
      {state.killFeed.length > 0 && <div className="killfeed">{state.killFeed.map(e => <div key={e.id} className={`feed-${e.kind}`}>{e.text}</div>)}</div>}
      {state.mode === "rescue" && state.contracts.length > 0 && !state.riding && <div className="contracts">
        {state.contracts.map(c => (
          <div key={c.id} className={c.done ? "done" : ""}>
            <b>{c.done ? "DONE" : `${c.progress}/${c.target}`}</b>
            <span>{c.title}<em>{c.desc}</em></span>
          </div>
        ))}
      </div>}
      {achievementVisible && state.achievement && <div key={state.achievement.id} className="achievement-toast"><span>ACHIEVEMENT</span><b>{state.achievement.title}</b><em>{state.achievement.desc}</em></div>}
      {messageVisible && state.message && state.status === "playing" && <div className="game-toast" role="status">{state.message}</div>}
    </>}
    <div className="health-readout" aria-label={`Health ${state.health} of 100`}>
      <span style={{ opacity: .3 + .7 * (state.health / 100) }}><Heart /></span>
      {state.health < 100 && <small>{state.health}</small>}
    </div>
    {state.riding ? <>
      <div className="ammo-chip" aria-label={`${state.weaponName}, ${state.ammo} rounds`}>
        <span>{WEAPONS[state.weaponKind].short}</span>
        <b>{state.reloading ? "···" : state.ammo}</b>
      </div>
      <div className="speed-readout"><div><strong>{state.speed.toString().padStart(2, "0")}</strong><span>km/h</span></div><p>{Math.min(state.checkpoint, state.totalCheckpoints)} / {state.totalCheckpoints} <span>CHECKPOINTS</span></p></div>
    </> : <div className="ammo-readout" aria-label={`${state.weaponName}, ${state.ammo} rounds, ${state.reserve} in reserve`}>
      <div className="ammo-details">
        <span>
          {state.weaponName}
          <em style={{ color: `#${equippedSkin.lineColor.toString(16).padStart(6, '0')}`, marginLeft: 6, fontStyle: 'normal', fontSize: '0.85em', opacity: 0.9 }}>
            [{equippedSkin.name.split('|')[1]?.trim() ?? equippedSkin.name}]
          </em>
        </span>
        <small>{state.reloading ? "Reloading" : `${state.ammo} / ${state.magazineSize}`}</small>
        {state.reloading && <i style={{ width: `${state.reloadProgress * 100}%` }} />}
      </div>
      <span className="mag-count">{mags}<span>×</span></span><Magazine />
    </div>}
    {!state.riding && state.inventory.length > 1 && active && <div className="weapon-slots">{SLOT_ORDER.filter(kind => state.inventory.includes(kind)).map(kind => <span key={kind} className={state.weaponKind === kind ? "selected" : ""}><b>{SLOT_ORDER.indexOf(kind) + 1}</b> {WEAPONS[kind].short}</span>)}</div>}
  </div>;
}
