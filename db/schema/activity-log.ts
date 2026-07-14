import {
    pgTable,
    serial,
    integer,
    varchar,
    text,
    timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./users";
export const activityLogs = pgTable("activity_logs", {
    id: serial("id").primaryKey(),

    userId: integer("user_id")
        .references(() => users.id)
        .notNull(),
    
    action: varchar("action", { length: 100 }).notNull(),

    description: text("description"),

    ipAddress: varchar("ip_address", { length: 45 }),

    createdAt: timestamp("created_at")
        .defaultNow()
        .notNull(),
});