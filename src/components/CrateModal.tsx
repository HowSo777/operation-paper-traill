"use client";

import { useState, useRef, useEffect } from "react";
import {
  SKINS,
  CRATE_SKINS,
  RARITY_CONFIG,
  loadInventory,
  saveInventory,
  rollRandomSkin,
  setEquippedSkin,
  type WeaponSkin,
  type InventoryState,
} from "@/game/skins";
import { sfx } from "@/game/audio";
import type { WeaponKind } from "@/game/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSkinEquipped?: () => void;
}

export function CrateModal({ open, onClose, onSkinEquipped }: Props) {
  const [activeTab, setActiveTab] = useState<"crate" | "inventory">("crate");
  const [inv, setInv] = useState<InventoryState>(loadInventory());
  const [spinning, setSpinning] = useState(false);
  const [unboxedSkin, setUnboxedSkin] = useState<WeaponSkin | null>(null);
  const [rouletteItems, setRouletteItems] = useState<WeaponSkin[]>([]);
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponKind>("rifle");
  const [equipToast, setEquipToast] = useState<string | null>(null);

  const reelRef = useRef<HTMLDivElement>(null);
  const tickAudioRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setInv(loadInventory());
      setUnboxedSkin(null);
      setSpinning(false);
      setEquipToast(null);
    }
  }, [open]);

  // Generate roulette items for crate display
  useEffect(() => {
    const list: WeaponSkin[] = [];
    for (let i = 0; i < 50; i++) {
      list.push(CRATE_SKINS[Math.floor(Math.random() * CRATE_SKINS.length)]);
    }
    setRouletteItems(list);
  }, []);

  const handleOpenCase = () => {
    if (inv.crates <= 0 || inv.keys <= 0 || spinning) return;

    // Deduct 1 crate and 1 key
    const nextInv: InventoryState = {
      ...inv,
      crates: inv.crates - 1,
      keys: inv.keys - 1,
    };

    // Roll winning skin
    const winner = rollRandomSkin();
    const winningIndex = 38; // Land around item 38

    // Build the roulette reel with the winner at winningIndex
    const newReel: WeaponSkin[] = [];
    for (let i = 0; i < 50; i++) {
      if (i === winningIndex) {
        newReel.push(winner);
      } else {
        newReel.push(CRATE_SKINS[Math.floor(Math.random() * CRATE_SKINS.length)]);
      }
    }
    setRouletteItems(newReel);
    setSpinning(true);
    setUnboxedSkin(null);

    // Save inventory deduction
    setInv(nextInv);
    saveInventory(nextInv);

    // Reset reel position
    if (reelRef.current) {
      reelRef.current.style.transition = "none";
      reelRef.current.style.transform = "translateX(0px)";
    }

    // Start spin animation on next tick
    setTimeout(() => {
      if (!reelRef.current) return;

      // Card width is 140px + 12px gap = 152px
      // Randomize slight offset within the winning card (+/- 45px)
      const cardWidth = 152;
      const targetOffset = -(winningIndex * cardWidth - 280 + (Math.random() * 70 - 35));

      reelRef.current.style.transition = "transform 4.6s cubic-bezier(0.12, 0.8, 0.28, 1)";
      reelRef.current.style.transform = `translateX(${targetOffset}px)`;

      // Authentic mechanical ticking sound simulation
      let tickCount = 0;
      const totalTicks = 38;
      const playTickSeries = () => {
        if (tickCount >= totalTicks) return;
        sfx.crateTick();
        tickCount++;
        // Ticks slow down progressively
        const progress = tickCount / totalTicks;
        const delay = 40 + Math.pow(progress, 2.5) * 350;
        tickAudioRef.current = window.setTimeout(playTickSeries, delay);
      };
      playTickSeries();

      // Finish spin
      setTimeout(() => {
        setSpinning(false);
        setUnboxedSkin(winner);
        sfx.crateWin(winner.rarity);

        // Add to unlocked inventory if not already owned
        const updated = loadInventory();
        if (!updated.unlockedSkinIds.includes(winner.id)) {
          updated.unlockedSkinIds.push(winner.id);
          saveInventory(updated);
          setInv(updated);
        }
      }, 4700);
    }, 50);
  };


  const handleEquip = (skin: WeaponSkin) => {
    setEquippedSkin(skin.weapon, skin.id);
    const updated = loadInventory();
    setInv(updated);
    sfx.uiClick();
    setEquipToast(`EQUIPPED: ${skin.name}`);
    window.setTimeout(() => setEquipToast(null), 2400);
    onSkinEquipped?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 select-none">
      <div className="relative w-full max-w-4xl bg-[#121620] border border-[#2a3140] rounded-lg overflow-hidden flex flex-col text-neutral-100 max-h-[92vh]">
        {equipToast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-green-500 border border-white text-black font-mono font-black text-xs rounded flex items-center gap-2 tracking-wider">
            <span>[OK]</span> {equipToast}
          </div>
        )}
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#232938] bg-[#0e111a]">
          <div className="flex items-center gap-4">
            <span className="text-base font-black font-mono tracking-wider text-amber-400">
              TACTICAL WEAPON ARSENAL
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("crate")}
                className={`px-3 py-1 text-xs font-mono font-bold rounded ${
                  activeTab === "crate"
                    ? "bg-amber-500 text-black"
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                }`}
              >
                UNBOXING
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("inventory")}
                className={`px-3 py-1 text-xs font-mono font-bold rounded ${
                  activeTab === "inventory"
                    ? "bg-amber-500 text-black"
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                }`}
              >
                SKIN ARSENAL ({inv.unlockedSkinIds.length})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="px-2.5 py-1 rounded bg-[#181d28] border border-[#2a3140]">
                CRATES: <b className="text-amber-400">{inv.crates}</b>
              </span>
              <span className="px-2.5 py-1 rounded bg-[#181d28] border border-[#2a3140]">
                KEYS: <b className="text-amber-400">{inv.keys}</b>
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono hidden sm:inline-block">
                RANK PROMOTION DROP
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-neutral-400 hover:text-white font-mono text-xl font-bold px-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Area */}
        {activeTab === "crate" ? (
          <div className="p-6 flex flex-col items-center gap-6 overflow-y-auto">
            {/* CS:GO Roulette Reel Container */}
            <div className="relative w-full overflow-hidden bg-neutral-950 border-2 border-neutral-700 rounded-lg p-2">
              {/* Centre Selection Needle */}
              <div className="absolute top-0 bottom-0 left-1/2 w-1 -translate-x-1/2 bg-amber-400 z-20">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-x-6 border-x-transparent border-t-8 border-t-amber-400" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 border-x-6 border-x-transparent border-b-8 border-b-amber-400" />
              </div>

              {/* Rolling Cards Reel */}
              <div
                ref={reelRef}
                className="flex gap-3 py-4 will-change-transform"
                style={{ transform: "translateX(0px)" }}
              >
                {rouletteItems.map((item, idx) => {
                  const rarity = RARITY_CONFIG[item.rarity];
                  return (
                    <div
                      key={`${item.id}-${idx}`}
                      className={`flex-shrink-0 w-35 h-44 rounded-lg border-2 ${rarity.border} ${rarity.bg} p-2.5 flex flex-col justify-between items-center text-center relative overflow-hidden`}
                    >
                      <div className="text-[10px] uppercase font-mono tracking-wider font-bold text-neutral-400">
                        {item.weapon.toUpperCase()}
                      </div>

                      {/* Wireframe Weapon Silhouette with Skin Color */}
                      <div
                        className="w-16 h-12 rounded flex items-center justify-center border"
                        style={{
                          borderColor: `#${item.lineColor.toString(16).padStart(6, "0")}`,
                          backgroundColor: `#${item.bodyColor.toString(16).padStart(6, "0")}33`,
                        }}
                      >
                        <div
                          className="w-10 h-3 rounded"
                          style={{
                            backgroundColor: `#${item.lineColor.toString(16).padStart(6, "0")}`,
                          }}
                        />
                      </div>

                      <div className="w-full">
                        <div className="text-xs font-bold font-mono truncate" title={item.name}>
                          {item.name.split("|")[1]?.trim() ?? item.name}
                        </div>
                        <div
                          className="text-[10px] font-mono font-semibold"
                          style={{ color: rarity.color }}
                        >
                          {rarity.label}
                        </div>
                      </div>

                      {/* Rarity Bottom Stripe */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-1.5"
                        style={{ backgroundColor: rarity.color }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Unboxed Winner Celebration Popup */}
            {unboxedSkin && (
              <div className="w-full bg-neutral-950 border-2 border-amber-400 rounded-xl p-5 flex items-center justify-between animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-5">
                  <div
                    className="w-24 h-20 rounded-lg flex items-center justify-center border-2"
                    style={{
                      borderColor: `#${unboxedSkin.lineColor.toString(16).padStart(6, "0")}`,
                      backgroundColor: `#${unboxedSkin.bodyColor.toString(16).padStart(6, "0")}`,
                    }}
                  >
                    <span className="text-xs font-black font-mono tracking-widest text-white">
                      {unboxedSkin.weapon.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-mono uppercase tracking-wider text-amber-400">
                      NEW WEAPON SKIN UNBOXED
                    </div>
                    <div className="text-xl font-black font-mono text-white">
                      {unboxedSkin.name}
                    </div>
                    <div
                      className="text-xs font-mono font-bold"
                      style={{ color: RARITY_CONFIG[unboxedSkin.rarity].color }}
                    >
                      {RARITY_CONFIG[unboxedSkin.rarity].label}
                    </div>
                    <div className="text-xs text-neutral-400 mt-1 max-w-md">
                      {unboxedSkin.description}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleEquip(unboxedSkin)}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black font-mono text-sm rounded tracking-wider transition-transform active:scale-95 cursor-pointer"
                >
                  EQUIP SKIN
                </button>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                disabled={spinning || inv.crates <= 0 || inv.keys <= 0}
                onClick={handleOpenCase}
                className={`px-10 py-3.5 rounded font-black font-mono text-base tracking-widest uppercase transition-all ${
                  spinning || inv.crates <= 0 || inv.keys <= 0
                    ? "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700"
                    : "bg-amber-500 hover:bg-amber-400 text-black cursor-pointer active:scale-95"
                }`}
              >
                {spinning ? "SPINNING CASE..." : "OPEN CASE (1 KEY)"}
              </button>

              <div className="text-xs font-mono text-neutral-400">
                Play Deathmatch / Rescue matches to earn guaranteed Crate & Key drops!
              </div>
            </div>

            {/* Case Contents Preview */}
            <div className="w-full mt-2">
              <div className="text-xs font-mono font-bold text-neutral-400 mb-2 uppercase tracking-wider">
                POSSIBLE CASE DROPS ({CRATE_SKINS.length} SKINS)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {CRATE_SKINS.map((skin) => {
                  const rarity = RARITY_CONFIG[skin.rarity];
                  const owned = inv.unlockedSkinIds.includes(skin.id);
                  return (
                    <div
                      key={skin.id}
                      className={`p-2 rounded border ${rarity.border} ${rarity.bg} relative flex flex-col justify-between`}
                    >
                      <div className="flex justify-between items-center text-[10px] font-mono text-neutral-400">
                        <span>{skin.weapon}</span>
                        {owned && <span className="text-green-400 font-bold">OWNED</span>}
                      </div>
                      <div className="text-xs font-bold font-mono truncate my-1" title={skin.name}>
                        {skin.name.split("|")[1]?.trim()}
                      </div>
                      <div
                        className="text-[9px] font-mono font-bold"
                        style={{ color: rarity.color }}
                      >
                        {rarity.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Inventory & Equipped Skins Management */
          <div className="p-6 flex flex-col gap-5 overflow-y-auto">
            {/* Weapon Selector Tabs */}
            <div className="flex gap-2 flex-wrap border-b border-neutral-800 pb-3">
              {(["rifle", "awp", "deagle", "smg", "p90", "shotgun", "sniper", "pistol"] as WeaponKind[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setSelectedWeapon(w)}
                  className={`px-3 py-1.5 rounded font-mono text-xs font-bold uppercase ${
                    selectedWeapon === w
                      ? "bg-amber-500 text-black"
                      : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>

            {/* Skins for Selected Weapon */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Object.values(SKINS)
                .filter((s) => s.weapon === selectedWeapon)
                .map((skin) => {
                  const rarity = RARITY_CONFIG[skin.rarity];
                  const owned = inv.unlockedSkinIds.includes(skin.id);
                  const isEquipped = inv.equippedSkins[skin.weapon] === skin.id;

                  return (
                    <div
                      key={skin.id}
                      className={`rounded-xl border-2 ${
                        isEquipped ? "border-amber-400 ring-2 ring-amber-400/40" : rarity.border
                      } ${rarity.bg} p-4 flex flex-col justify-between gap-3`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[11px] font-mono font-bold"
                          style={{ color: rarity.color }}
                        >
                          {rarity.label}
                        </span>
                        {isEquipped ? (
                          <span className="px-2 py-0.5 rounded bg-green-500 text-black text-[10px] font-black font-mono">
                            EQUIPPED
                          </span>
                        ) : owned ? (
                          <span className="text-green-400 text-[10px] font-mono font-bold">
                            UNLOCKED
                          </span>
                        ) : (
                          <span className="text-neutral-500 text-[10px] font-mono font-bold">
                            LOCKED IN CASE
                          </span>
                        )}
                      </div>

                      {/* 3D Color Swatch Preview */}
                      <div
                        className="w-full h-16 rounded-lg flex items-center justify-center border"
                        style={{
                          backgroundColor: `#${skin.bodyColor.toString(16).padStart(6, "0")}`,
                          borderColor: `#${skin.lineColor.toString(16).padStart(6, "0")}`,
                        }}
                      >
                        <div
                          className="px-4 py-1 rounded text-xs font-mono font-black border"
                          style={{
                            color: `#${skin.lineColor.toString(16).padStart(6, "0")}`,
                            borderColor: `#${skin.lineColor.toString(16).padStart(6, "0")}`,
                            backgroundColor: `#${skin.furnitureColor.toString(16).padStart(6, "0")}88`,
                          }}
                        >
                          WIREFRAME TINT
                        </div>
                      </div>

                      <div>
                        <div className="font-mono font-bold text-sm text-white">{skin.name}</div>
                        <div className="text-xs text-neutral-400 mt-1 line-clamp-2">
                          {skin.description}
                        </div>
                      </div>

                      {owned ? (
                        <button
                          type="button"
                          disabled={isEquipped}
                          onClick={() => handleEquip(skin)}
                          className={`w-full py-2 rounded font-mono text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                            isEquipped
                              ? "bg-green-950/80 border border-green-500/60 text-green-400 cursor-default"
                              : "bg-amber-500 hover:bg-amber-400 text-black active:scale-95 cursor-pointer"
                          }`}
                        >
                          {isEquipped ? "CURRENTLY EQUIPPED" : "EQUIP TO LOADOUT"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveTab("crate")}
                          className="w-full py-2 rounded bg-neutral-800 hover:bg-neutral-700 font-mono text-xs text-neutral-300 border border-neutral-700"
                        >
                          UNBOX FROM CASE
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
