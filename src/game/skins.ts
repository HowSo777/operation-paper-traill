/**
 * CS:GO-inspired Weapon Skin & Crate Unboxing System.
 * Pure data + localStorage persistence with Three.js wireframe tint integration.
 */
import type { WeaponKind } from "./types";

export type SkinRarity = "consumer" | "milspec" | "restricted" | "covert" | "special";

export interface WeaponSkin {
  id: string;
  name: string;
  weapon: WeaponKind;
  rarity: SkinRarity;
  bodyColor: number;
  furnitureColor: number;
  lineColor: number;
  description: string;
  patternName?: string;
}

export const RARITY_CONFIG: Record<SkinRarity, { label: string; color: string; hex: number; border: string; bg: string }> = {
  consumer: { label: "Consumer Grade", color: "#b0c3d9", hex: 0xb0c3d9, border: "border-neutral-400", bg: "bg-neutral-800" },
  milspec: { label: "Mil-Spec", color: "#4b69ff", hex: 0x4b69ff, border: "border-blue-500", bg: "bg-blue-950/80" },
  restricted: { label: "Restricted", color: "#8847ff", hex: 0x8847ff, border: "border-purple-500", bg: "bg-purple-950/80" },
  covert: { label: "Covert", color: "#eb4b4b", hex: 0xeb4b4b, border: "border-red-500", bg: "bg-red-950/80" },
  special: { label: "★ Special Rare", color: "#ffd700", hex: 0xffd700, border: "border-amber-400", bg: "bg-amber-950/80" },
};

export const SKINS: Record<string, WeaponSkin> = {
  // AK-47
  "rifle_default": {
    id: "rifle_default",
    name: "AK-47 | Standard Issue",
    weapon: "rifle",
    rarity: "consumer",
    bodyColor: 0x4b5155,
    furnitureColor: 0xb87943,
    lineColor: 0x35485a,
    description: "Standard tactical finish with seasoned wood furniture.",
  },
  "rifle_cobalt": {
    id: "rifle_cobalt",
    name: "AK-47 | Ice Cobalt",
    weapon: "rifle",
    rarity: "milspec",
    bodyColor: 0x1e3a8a,
    furnitureColor: 0x38bdf8,
    lineColor: 0x00f0ff,
    description: "Sub-zero cryo treatment with electric cyan wireframe conduits.",
  },
  "rifle_cyber": {
    id: "rifle_cyber",
    name: "AK-47 | Cyber Violet",
    weapon: "rifle",
    rarity: "restricted",
    bodyColor: 0x581c87,
    furnitureColor: 0xc084fc,
    lineColor: 0xe879f9,
    description: "Synthwave purple anodized alloy with neon ultraviolet traces.",
  },
  "rifle_dragon": {
    id: "rifle_dragon",
    name: "AK-47 | Dragon Fire",
    weapon: "rifle",
    rarity: "covert",
    bodyColor: 0x991b1b,
    furnitureColor: 0xf97316,
    lineColor: 0xff1744,
    description: "Forged in dragon breath. Emits molten embers along heat vents.",
  },
  "rifle_gold": {
    id: "rifle_gold",
    name: "AK-47 | 24K HyperWire",
    weapon: "rifle",
    rarity: "special",
    bodyColor: 0x1c1917,
    furnitureColor: 0xd97706,
    lineColor: 0xffd700,
    description: "Solid 24-karat gold wireframe plating. The apex of prestige.",
  },

  // AWP
  "awp_default": {
    id: "awp_default",
    name: "AWP | Arctic Grey",
    weapon: "awp",
    rarity: "consumer",
    bodyColor: 0x3f4e4f,
    furnitureColor: 0x2c3639,
    lineColor: 0x222831,
    description: "Military matte polymer chassis with carbon barrel.",
  },
  "awp_frost": {
    id: "awp_frost",
    name: "AWP | Glacial Frost",
    weapon: "awp",
    rarity: "milspec",
    bodyColor: 0x0c4a6e,
    furnitureColor: 0x7dd3fc,
    lineColor: 0x38bdf8,
    description: "Deep cryogenic crystalline finish. Cold as a sniper's breath.",
  },
  "awp_hyperbeast": {
    id: "awp_hyperbeast",
    name: "AWP | Hyper Beast",
    weapon: "awp",
    rarity: "covert",
    bodyColor: 0x111827,
    furnitureColor: 0xec4899,
    lineColor: 0x06b6d4,
    description: "Psychedelic monster wireframe with fluorescent fangs.",
  },
  "awp_dragonlore": {
    id: "awp_dragonlore",
    name: "AWP | Dragon Lore",
    weapon: "awp",
    rarity: "special",
    bodyColor: 0x78350f,
    furnitureColor: 0xfbbf24,
    lineColor: 0xffd700,
    description: "Ancient Celtic golden dragon knotwork engraved into high-velocity titanium.",
  },

  // DESERT EAGLE
  "deagle_default": {
    id: "deagle_default",
    name: "Deagle | Industrial Steel",
    weapon: "deagle",
    rarity: "consumer",
    bodyColor: 0x334155,
    furnitureColor: 0x1e293b,
    lineColor: 0x475569,
    description: "Heavy machined ordnance steel with textured grip panels.",
  },
  "deagle_cobalt": {
    id: "deagle_cobalt",
    name: "Deagle | Blue Steel",
    weapon: "deagle",
    rarity: "milspec",
    bodyColor: 0x1e40af,
    furnitureColor: 0x60a5fa,
    lineColor: 0x38bdf8,
    description: "Heat-tempered blued steel slide with precision blue laser rails.",
  },
  "deagle_blaze": {
    id: "deagle_blaze",
    name: "Deagle | Blaze",
    weapon: "deagle",
    rarity: "covert",
    bodyColor: 0x0f172a,
    furnitureColor: 0xe11d48,
    lineColor: 0xf97316,
    description: "A dark black chassis engulfed in incandescent flame wireframes.",
  },
  "deagle_gold": {
    id: "deagle_gold",
    name: "Deagle | Golden Koi",
    weapon: "deagle",
    rarity: "special",
    bodyColor: 0xb45309,
    furnitureColor: 0xfef08a,
    lineColor: 0xffd700,
    description: "Mirrored 24-karat gold finish with iridescent scale patterns.",
  },

  // MP5
  "smg_default": {
    id: "smg_default",
    name: "MP5 | Tactical Black",
    weapon: "smg",
    rarity: "consumer",
    bodyColor: 0x3d4951,
    furnitureColor: 0x363d42,
    lineColor: 0x35485a,
    description: "Matte black tactical CQB finish.",
  },
  "smg_acid": {
    id: "smg_acid",
    name: "MP5 | Acid Glitch",
    weapon: "smg",
    rarity: "milspec",
    bodyColor: 0x14532d,
    furnitureColor: 0x4ade80,
    lineColor: 0x22c55e,
    description: "Corrosive biohazard green wireframe accents.",
  },
  "smg_fade": {
    id: "smg_fade",
    name: "MP5 | Amber Fade",
    weapon: "smg",
    rarity: "restricted",
    bodyColor: 0x7c2d12,
    furnitureColor: 0xf97316,
    lineColor: 0xfb923c,
    description: "Anodized heat-treated rainbow fade across the upper receiver.",
  },

  // P90
  "p90_default": {
    id: "p90_default",
    name: "P90 | Sub-Zero",
    weapon: "p90",
    rarity: "consumer",
    bodyColor: 0x334155,
    furnitureColor: 0x64748b,
    lineColor: 0x475569,
    description: "Reinforced synthetic thumbhole stock with clear magazine top.",
  },
  "p90_asiimov": {
    id: "p90_asiimov",
    name: "P90 | Cyber Asiimov",
    weapon: "p90",
    rarity: "covert",
    bodyColor: 0xf8fafc,
    furnitureColor: 0xea580c,
    lineColor: 0x0f172a,
    description: "Stark sci-fi white polymer accented with high-visibility safety orange stripes.",
  },

  // SHOTGUN (M870)
  "shotgun_default": {
    id: "shotgun_default",
    name: "M870 | Field Agent",
    weapon: "shotgun",
    rarity: "consumer",
    bodyColor: 0x596267,
    furnitureColor: 0xa5734b,
    lineColor: 0x35485a,
    description: "Pump-action reliability with rugged oak forend.",
  },
  "shotgun_damascus": {
    id: "shotgun_damascus",
    name: "M870 | Crimson Damascus",
    weapon: "shotgun",
    rarity: "covert",
    bodyColor: 0x7f1d1d,
    furnitureColor: 0x991b1b,
    lineColor: 0xef4444,
    description: "Hand-folded Damascus steel patterned in blood red ribbons.",
  },

  // SVD
  "sniper_default": {
    id: "sniper_default",
    name: "SVD | Field Marksman",
    weapon: "sniper",
    rarity: "consumer",
    bodyColor: 0x718269,
    furnitureColor: 0x879777,
    lineColor: 0x35485a,
    description: "Standard military issue semi-automatic sniper rifle.",
  },
  "sniper_camo": {
    id: "sniper_camo",
    name: "SVD | Ghost Viper",
    weapon: "sniper",
    rarity: "restricted",
    bodyColor: 0x064e3b,
    furnitureColor: 0x10b981,
    lineColor: 0x34d399,
    description: "Tactical ghillie camouflage with viper green wireframe optics.",
  },

  // PISTOL
  "pistol_default": {
    id: "pistol_default",
    name: "P9 | Compact Tan",
    weapon: "pistol",
    rarity: "consumer",
    bodyColor: 0x22272b,
    furnitureColor: 0x9b7953,
    lineColor: 0x35485a,
    description: "Two-tone matte black slide with desert tan polymer lower.",
  },
  "pistol_laser": {
    id: "pistol_laser",
    name: "P9 | Cyber Laser",
    weapon: "pistol",
    rarity: "milspec",
    bodyColor: 0x18181b,
    furnitureColor: 0x06b6d4,
    lineColor: 0x22d3ee,
    description: "Stealth black chassis with illuminated cyan fiber sight lines.",
  },
};

/** All unboxable non-default skins for the CS:GO crate. */
export const CRATE_SKINS = Object.values(SKINS).filter(s => s.rarity !== "consumer");

export interface InventoryState {
  crates: number;
  keys: number;
  unlockedSkinIds: string[];
  equippedSkins: Record<WeaponKind, string>;
}

const STORAGE_KEY = "papertrail.csgo.inventory.v1";

export const DEFAULT_INVENTORY: InventoryState = {
  crates: 3, // Start with 3 free cases to open!
  keys: 3,
  unlockedSkinIds: [
    "rifle_default", "awp_default", "deagle_default", "smg_default",
    "p90_default", "shotgun_default", "sniper_default", "pistol_default",
  ],
  equippedSkins: {
    rifle: "rifle_default",
    awp: "awp_default",
    deagle: "deagle_default",
    smg: "smg_default",
    p90: "p90_default",
    shotgun: "shotgun_default",
    sniper: "sniper_default",
    pistol: "pistol_default",
  },
};

export function loadInventory(): InventoryState {
  try {
    if (typeof window === "undefined") return DEFAULT_INVENTORY;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INVENTORY;
    const parsed = JSON.parse(raw);
    return {
      crates: Math.max(0, Number(parsed.crates) ?? 3),
      keys: Math.max(0, Number(parsed.keys) ?? 3),
      unlockedSkinIds: Array.isArray(parsed.unlockedSkinIds) ? parsed.unlockedSkinIds : DEFAULT_INVENTORY.unlockedSkinIds,
      equippedSkins: { ...DEFAULT_INVENTORY.equippedSkins, ...(parsed.equippedSkins ?? {}) },
    };
  } catch {
    return DEFAULT_INVENTORY;
  }
}

export function saveInventory(inv: InventoryState): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inv));
  } catch {}
}

/** CS:GO Rarity probability weighting */
export function rollRandomSkin(): WeaponSkin {
  const rand = Math.random() * 100;
  let targetRarity: SkinRarity;

  if (rand < 3) {
    targetRarity = "special"; // 3% Gold knife / lore tier
  } else if (rand < 15) {
    targetRarity = "covert"; // 12% Red
  } else if (rand < 40) {
    targetRarity = "restricted"; // 25% Purple
  } else {
    targetRarity = "milspec"; // 60% Blue
  }

  const pool = CRATE_SKINS.filter(s => s.rarity === targetRarity);
  if (pool.length === 0) return CRATE_SKINS[Math.floor(Math.random() * CRATE_SKINS.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Active equipped skin lookup for 3D engine */
let activeSkins: Record<WeaponKind, WeaponSkin> = {
  rifle: SKINS["rifle_default"],
  awp: SKINS["awp_default"],
  deagle: SKINS["deagle_default"],
  smg: SKINS["smg_default"],
  p90: SKINS["p90_default"],
  shotgun: SKINS["shotgun_default"],
  sniper: SKINS["sniper_default"],
  pistol: SKINS["pistol_default"],
};

export function setEquippedSkin(weapon: WeaponKind, skinId: string): void {
  if (SKINS[skinId]) {
    activeSkins[weapon] = SKINS[skinId];
    const inv = loadInventory();
    inv.equippedSkins[weapon] = skinId;
    saveInventory(inv);
  }
}

export function getEquippedSkin(weapon: WeaponKind): WeaponSkin {
  return activeSkins[weapon] || SKINS[`${weapon}_default`] || SKINS["rifle_default"];
}

export function initEquippedSkinsFromStorage(): void {
  const inv = loadInventory();
  for (const [weapon, skinId] of Object.entries(inv.equippedSkins)) {
    if (SKINS[skinId]) {
      activeSkins[weapon as WeaponKind] = SKINS[skinId];
    }
  }
}
