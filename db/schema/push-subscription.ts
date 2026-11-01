import { sql } from "drizzle-orm";
import { pgTable, uuid, integer, boolean, varchar, timestamp, check } from "drizzle-orm/pg-core";
import { users } from "./users";

// Disabled rows retain only a generation barrier, never a usable push capability.
export const pushSubscriptions = pgTable("push_subscriptions", {
    id: uuid("id").primaryKey(),
    userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    endpoint: varchar("endpoint", { length: 2048 }).unique(),
    p256dh: varchar("p256dh", { length: 87 }),
    auth: varchar("auth", { length: 22 }),
    vapidKeyId: varchar("vapid_key_id", { length: 64 }),
    authorizedUntil: timestamp("authorized_until", { withTimezone: true }),
    browserExpiresAt: timestamp("browser_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
    check("push_subscription_material_check", sql`(
        ${table.enabled} and ${table.endpoint} is not null and ${table.p256dh} is not null and ${table.auth} is not null
        and ${table.vapidKeyId} is not null and ${table.authorizedUntil} is not null
    ) or (not ${table.enabled} and ${table.endpoint} is null and ${table.p256dh} is null and ${table.auth} is null
        and ${table.vapidKeyId} is null and ${table.authorizedUntil} is null and ${table.browserExpiresAt} is null)`),
    check("push_subscription_endpoint_check", sql`${table.endpoint} is null or (octet_length(${table.endpoint}) <= 2048 and ${table.endpoint} ~ '^https://[^[:space:]]+$')`),
    check("push_subscription_keys_check", sql`(${table.p256dh} is null or ${table.p256dh} ~ '^[A-Za-z0-9_-]{87}$') and (${table.auth} is null or ${table.auth} ~ '^[A-Za-z0-9_-]{22}$') and (${table.vapidKeyId} is null or ${table.vapidKeyId} ~ '^[A-Za-z0-9_-]{1,64}$')`),
    check("push_subscription_expiry_check", sql`not ${table.enabled} or (${table.authorizedUntil} > ${table.updatedAt} and (${table.browserExpiresAt} is null or ${table.browserExpiresAt} >= ${table.authorizedUntil}))`),
]);
