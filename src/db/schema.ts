import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** One entry per finished (or failed) infiltration run. */
export const missionRuns = pgTable("mission_runs", {
  id: serial("id").primaryKey(),
  playerName: text("player_name").notNull(),
  result: text("result").notNull().default("accomplished"),
  kills: integer("kills").notNull().default(0),
  timeMs: integer("time_ms").notNull().default(0),
  accuracy: integer("accuracy").notNull().default(0),
  score: integer("score").notNull().default(0),
  difficulty: text("difficulty").notNull().default("regular"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type MissionRun = typeof missionRuns.$inferSelect;
