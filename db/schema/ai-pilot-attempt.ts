import { sql } from "drizzle-orm";
import { pgTable, uuid, integer, timestamp, check, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";

// Operational metadata only. An unreleased attempt blocks all instances until safely recovered.
export const aiPilotAttempts = pgTable("ai_pilot_attempts", {
    id: uuid("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
}, table => [
    index("ai_pilot_day_idx").on(table.attemptedAt),
    index("ai_pilot_user_time_idx").on(table.userId, table.attemptedAt),
    uniqueIndex("ai_pilot_one_active_idx").on(sql`(1)`).where(sql`${table.releasedAt} is null`),
    check("ai_pilot_release_check", sql`${table.releasedAt} is null or ${table.releasedAt} >= ${table.attemptedAt}`),
]);
