import {
    pgTable,
    serial,
    integer,
    varchar,
    text,
    timestamp,
    boolean,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const notifications = pgTable("notifications", {
    id: serial("id").primaryKey(),

    userId: integer("user_id")
        .references(() => users.id)
        .notNull(),
    
    title: varchar("title", { length: 200 }).notNull(),

    message: text("message").notNull(),

    isRead: boolean("is_read")
        .default(false)
        .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});