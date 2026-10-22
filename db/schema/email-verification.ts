import { sql } from "drizzle-orm";
import { pgTable, integer, varchar, timestamp, check } from "drizzle-orm/pg-core";
import { users } from "./users";

export const emailVerificationRequests = pgTable("email_verification_requests", {
    userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "restrict" }),
    requestedEmail: varchar("requested_email", { length: 255 }).notNull(),
    tokenDigest: varchar("token_digest", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    lastRequestedAt: timestamp("last_requested_at", { withTimezone: true }).notNull(),
    // At most five instants suffice for an exact rolling-hour limit; keep across resends.
    requestTimes: timestamp("request_times", { withTimezone: true }).array().notNull(),
}, table => [
    check("email_verification_digest_check", sql`${table.tokenDigest} ~ '^[a-f0-9]{64}$'`),
    check("email_verification_times_check", sql`cardinality(${table.requestTimes}) between 1 and 5 and array_position(${table.requestTimes}, null) is null`),
    check("email_verification_expiry_check", sql`${table.expiresAt} > ${table.lastRequestedAt}`),
    check("email_verification_consumption_check", sql`${table.consumedAt} is null or (${table.consumedAt} >= ${table.lastRequestedAt} and ${table.consumedAt} < ${table.expiresAt})`),
]);
