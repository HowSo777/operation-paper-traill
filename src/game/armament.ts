import type { DifficultyId, PerkId, PrimaryKind, Vec3, WeaponKind } from "./types";

export type WeaponSpec = {
  name: string;
  short: string;
  calibre: string;
  damage: number;
  pellets: number;
  auto: boolean;
  magSize: number;
  reserve: number;
  interval: number;
  reloadTime: number;
  spread: number;
  recoil: number;
  zoom: number;
  blurb: string;
};

export const WEAPONS: Record<WeaponKind, WeaponSpec> = {
  rifle: { name: "AK-47", short: "AK-47", calibre: "7.62 × 39", damage: 34, pellets: 1, auto: true, magSize: 30, reserve: 120, interval: 0.12, reloadTime: 2, spread: 0.007, recoil: 0.008, zoom: 58, blurb: "Balanced workhorse. Reliable at any range." },
  smg: { name: "MP5", short: "MP5", calibre: "9 × 19", damage: 24, pellets: 1, auto: true, magSize: 30, reserve: 150, interval: 0.075, reloadTime: 1.55, spread: 0.012, recoil: 0.005, zoom: 60, blurb: "Bullet hose. Melts rooms and riders up close." },
  p90: { name: "P90", short: "P90", calibre: "5.7 × 28", damage: 22, pellets: 1, auto: true, magSize: 50, reserve: 150, interval: 0.065, reloadTime: 2.1, spread: 0.014, recoil: 0.004, zoom: 60, blurb: "50-round bullpup submachine gun. Relentless spray and mob suppression." },
  sniper: { name: "SVD", short: "SVD", calibre: "7.62 × 54", damage: 125, pellets: 1, auto: false, magSize: 10, reserve: 40, interval: 0.9, reloadTime: 2.5, spread: 0.0009, recoil: 0.027, zoom: 26, blurb: "One shot, one kill. Scoped precision." },
  awp: { name: "AWP", short: "AWP", calibre: ".338 Lapua", damage: 115, pellets: 1, auto: false, magSize: 5, reserve: 25, interval: 1.25, reloadTime: 2.8, spread: 0.0004, recoil: 0.045, zoom: 18, blurb: "High risk, high reward. 1-shot torso/head kill; leg shots deal 85 damage." },
  shotgun: { name: "M870 Breacher", short: "M870", calibre: "12 gauge", damage: 13, pellets: 8, auto: false, magSize: 6, reserve: 42, interval: 0.95, reloadTime: 2.3, spread: 0.035, recoil: 0.03, zoom: 60, blurb: "Eight pellets of diplomacy. Devastating close up." },
  pistol: { name: "P9 Sidearm", short: "P9", calibre: "9 × 19", damage: 22, pellets: 1, auto: false, magSize: 12, reserve: 72, interval: 0.22, reloadTime: 1.4, spread: 0.009, recoil: 0.007, zoom: 62, blurb: "Trusty fallback. Always in your holster." },
  deagle: { name: "Desert Eagle", short: "DEAGLE", calibre: ".50 AE", damage: 72, pellets: 1, auto: false, magSize: 7, reserve: 35, interval: 0.32, reloadTime: 1.75, spread: 0.007, recoil: 0.032, zoom: 62, blurb: "Hand cannon. Brutal stopping power and skull-cracking punch." },
};

export const PRIMARY_ORDER: PrimaryKind[] = ["rifle", "smg", "p90", "shotgun", "sniper", "awp"];
export const SLOT_ORDER: WeaponKind[] = ["rifle", "smg", "p90", "sniper", "awp", "shotgun", "pistol", "deagle"];

export type LoadoutCard = {
  id: PrimaryKind;
  tagline: string;
  stats: { damage: number; rpm: number; range: number; control: number };
};

export const LOADOUTS: LoadoutCard[] = [
  { id: "rifle", tagline: "All-rounder", stats: { damage: 3, rpm: 3, range: 4, control: 3 } },
  { id: "smg", tagline: "Close quarters", stats: { damage: 2, rpm: 5, range: 2, control: 5 } },
  { id: "p90", tagline: "50-Round Spray", stats: { damage: 2, rpm: 5, range: 3, control: 4 } },
  { id: "shotgun", tagline: "Breacher", stats: { damage: 5, rpm: 1, range: 1, control: 2 } },
  { id: "sniper", tagline: "Marksman", stats: { damage: 4, rpm: 2, range: 5, control: 2 } },
  { id: "awp", tagline: "Bolt-Action Precision", stats: { damage: 5, rpm: 1, range: 5, control: 1 } },
];

export type PerkDef = { id: PerkId; name: string; desc: string };
export const PERKS: PerkDef[] = [
  { id: "medic", name: "Field Medic", desc: "Health regenerates twice as fast." },
  { id: "scout", name: "Scout", desc: "+10% move speed, quieter footsteps." },
  { id: "armor", name: "Ballistic Vest", desc: "Take 30% less damage." },
];

export type DifficultyDef = { id: DifficultyId; name: string; desc: string; damageMul: number; xpMul: number };
export const DIFFICULTIES: DifficultyDef[] = [
  { id: "recruit", name: "Recruit", desc: "Enemies hit softer. Learn the map.", damageMul: 0.6, xpMul: 1 },
  { id: "regular", name: "Regular", desc: "The intended fight. +25% XP.", damageMul: 1, xpMul: 1.25 },
  { id: "veteran", name: "Veteran", desc: "Brutal damage. +60% XP. Glory.", damageMul: 1.5, xpMul: 1.6 },
];

export type PickupDef = { id: string; kind: WeaponKind | "ammo"; pos: Vec3; yaw: number };
export const PICKUP_SPAWNS: PickupDef[] = [
  { id: "staging-mp5", kind: "smg", pos: [2.2, 1.18, 57.5], yaw: 0.9 },
  { id: "staging-ammo", kind: "ammo", pos: [-2.2, 1.05, 57], yaw: 0 },
  { id: "warehouse-ak", kind: "rifle", pos: [-5.5, 1.12, 18], yaw: 0.5 },
  { id: "tower-svd", kind: "sniper", pos: [-1, 10.85, -19], yaw: 1.2 },
  { id: "tower-awp", kind: "awp", pos: [55, 10.85, 10], yaw: -0.8 },
  { id: "bunker-deagle", kind: "deagle", pos: [-58, 1.1, -30], yaw: 0 },
  { id: "depot-p90", kind: "p90", pos: [30, 1.15, -45], yaw: 1.8 },
  { id: "barracks-ammo", kind: "ammo", pos: [9, 1.02, -21], yaw: 0 },
  { id: "stores-shotgun", kind: "shotgun", pos: [-70, 1.52, 42], yaw: 0.4 },
  { id: "east-ammo", kind: "ammo", pos: [72, 1.92, -20], yaw: 0 },
];

/**
 * Bullet cone in radians. Aiming holds breath: the shot lands exactly where the
 * optic is pointed, with the sniper being effectively laser-accurate. Hip fire
 * keeps movement and footing penalties.
 */
export function weaponMoveMultiplier(kind: WeaponKind, aiming: boolean): number {
  if (kind !== "sniper" && kind !== "awp") return 1;
  return aiming ? 0.45 : 0.75;
}

export function shotSpread(
  kind: WeaponKind,
  opts: { aiming: boolean; moving: boolean; sprinting: boolean; grounded: boolean },
): number {
  const spec = WEAPONS[kind];
  if (kind === "awp") {
    // When aiming through optic: surgical precision
    if (opts.aiming) return spec.spread * 0.02;
    // When not aiming (no-scope hip fire): massive CS:GO bloom
    return 0.16 + (opts.moving ? 0.09 : 0) + (opts.sprinting ? 0.14 : 0) + (opts.grounded ? 0 : 0.09);
  }
  const isSniper = kind === "sniper";
  if (opts.aiming) return spec.spread * (isSniper ? 0.04 : 0.22);
  if (isSniper) {
    return 0.045 + (opts.moving ? 0.02 : 0) + (opts.sprinting ? 0.04 : 0) + (opts.grounded ? 0 : 0.03);
  }
  return spec.spread + (opts.moving ? 0.006 : 0) + (opts.sprinting ? 0.015 : 0) + (opts.grounded ? 0 : 0.014);
}
