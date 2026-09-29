/**
 * Competitive Rank System inspired by CS:GO / Valorant.
 * Ranks are calculated from lifetime XP and match performance.
 */

export interface RankTier {
  id: string;
  tier: number;
  name: string;
  minXp: number;
  badgeColor: string;
  badgeHex: number;
  stars: number;
  division: string;
}

export const RANKS: RankTier[] = [
  { id: "silver_1", tier: 1, name: "Silver I", minXp: 0, badgeColor: "#94a3b8", badgeHex: 0x94a3b8, stars: 1, division: "S-1" },
  { id: "silver_elite", tier: 2, name: "Silver Elite", minXp: 400, badgeColor: "#cbd5e1", badgeHex: 0xcbd5e1, stars: 3, division: "SE" },
  { id: "gold_nova_1", tier: 3, name: "Gold Nova I", minXp: 1000, badgeColor: "#facc15", badgeHex: 0xfacc15, stars: 1, division: "GN-1" },
  { id: "gold_nova_master", tier: 4, name: "Gold Nova Master", minXp: 1800, badgeColor: "#eab308", badgeHex: 0xeab308, stars: 4, division: "GNM" },
  { id: "master_guardian", tier: 5, name: "Master Guardian", minXp: 2800, badgeColor: "#38bdf8", badgeHex: 0x38bdf8, stars: 1, division: "MG" },
  { id: "legendary_eagle", tier: 6, name: "Legendary Eagle", minXp: 4000, badgeColor: "#a855f7", badgeHex: 0xa855f7, stars: 2, division: "LE" },
  { id: "supreme_master", tier: 7, name: "Supreme Operative", minXp: 5500, badgeColor: "#ec4899", badgeHex: 0xec4899, stars: 3, division: "SMFC" },
  { id: "global_elite", tier: 8, name: "The Global Elite", minXp: 7500, badgeColor: "#f59e0b", badgeHex: 0xf59e0b, stars: 5, division: "GLOBAL" },
];

export function getRankForXp(xp: number): {
  rank: RankTier;
  nextRank: RankTier | null;
  progressPercent: number;
  xpInRank: number;
  xpNeededForNext: number;
} {
  const currentXp = Math.max(0, Math.floor(xp));
  let currentRank = RANKS[0];
  let nextRank: RankTier | null = RANKS[1];

  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (currentXp >= RANKS[i].minXp) {
      currentRank = RANKS[i];
      nextRank = i < RANKS.length - 1 ? RANKS[i + 1] : null;
      break;
    }
  }

  if (!nextRank) {
    return {
      rank: currentRank,
      nextRank: null,
      progressPercent: 100,
      xpInRank: currentXp - currentRank.minXp,
      xpNeededForNext: 0,
    };
  }

  const range = nextRank.minXp - currentRank.minXp;
  const inRank = currentXp - currentRank.minXp;
  const progressPercent = Math.min(100, Math.max(0, Math.floor((inRank / range) * 100)));

  return {
    rank: currentRank,
    nextRank,
    progressPercent,
    xpInRank: inRank,
    xpNeededForNext: nextRank.minXp - currentXp,
  };
}
