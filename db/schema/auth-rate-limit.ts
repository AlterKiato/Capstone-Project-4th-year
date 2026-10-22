import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, integer, primaryKey, index, check } from "drizzle-orm/pg-core";

// Operational counters only: no user relationship, email, IP, password or token.
export const authRateLimitBuckets = pgTable("auth_rate_limit_buckets", {
    keyDigest: varchar("key_digest", { length: 64 }).notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    hitCount: integer("hit_count").notNull(),
}, table => [
    primaryKey({ columns: [table.keyDigest, table.windowStart] }),
    index("auth_rate_limit_expiry_idx").on(table.expiresAt),
    check("auth_rate_limit_digest_check", sql`${table.keyDigest} ~ '^[a-f0-9]{64}$'`),
    check("auth_rate_limit_count_check", sql`${table.hitCount} > 0`),
    check("auth_rate_limit_expiry_check", sql`${table.expiresAt} > ${table.windowStart}`),
]);
