/**
 * Shared, framework agnostic types for the wireframe FPS.
 * Everything here is plain data so it can be serialised over the wire and
 * reused by the Node game server without pulling in Three.js.
 */

export type Vec3 = [number, number, number];

/** Axis aligned bounding box, min/max in world space. */
export type AABB = {
  min: Vec3;
  max: Vec3;
};

export type BoxKind =
  | "ground"
  | "wall"
  | "building"
  | "towerLeg"
  | "platform"
  | "railing"
  | "crate"
  | "container"
  | "fence"
  | "pillar"
  /** Map-edge barrier: blocks movement only, never bullets or sight. */
  | "boundary"
  /** Earth berm over the bunker: visible, solid, stops bullets. */
  | "berm";

/** A solid box. `pos` is the centre, `size` the full extents. */
export type BoxDef = {
  kind: BoxKind;
  pos: Vec3;
  size: Vec3;
};

export type TowerDef = {
  id: string;
  pos: Vec3;
  platformHeight: number;
};

export type LadderDef = {
  id: string;
  /** Centre of the ladder column (x, z matter, y is the base). */
  pos: Vec3;
  yMin: number;
  yMax: number;
  radius: number;
};

export type EnemyKind = "guard" | "sniper";
export type SecondaryKind = "pistol" | "deagle";
export type WeaponKind = "rifle" | "smg" | "sniper" | "shotgun" | "pistol" | "deagle" | "awp" | "p90";
export type PrimaryKind = Exclude<WeaponKind, SecondaryKind>;
export type TeamId = "blue" | "red";
export type TeamOrSpectator = TeamId | "spectator";
export type GameMode = "rescue" | "deathmatch";
export type PerkId = "medic" | "scout" | "armor";
export type DifficultyId = "recruit" | "regular" | "veteran";
export type Loadout = { primary: PrimaryKind; secondary?: SecondaryKind; perk: PerkId };

export type EnemySpawnDef = {
  id: string;
  kind: EnemyKind;
  pos: Vec3;
  yaw: number;
  patrol: Vec3[];
};

export type HostageDef = {
  pos: Vec3;
  yaw: number;
};

export type BikeDef = {
  pos: Vec3;
  yaw: number;
};
