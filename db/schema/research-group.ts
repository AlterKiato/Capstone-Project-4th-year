import {
    pgTable,
    serial,
    varchar,
    integer,
    timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const researchGroups = pgTable("research_groups", {
    id: serial("id").primaryKey(),

    groupName: varchar("group_name", { length: 100 }).notNull(),

    strand: varchar("strand", { length: 50 }).notNull(),

    section: varchar("section", { length: 50 }).notNull(),

    schoolYear: varchar("school_year", { length: 20 }).notNull(),

    adviserId: integer("adviser_id")
        .notNull()
        .references(() => users.id),

    status: varchar("status", { length: 20 })
        .notNull()
        .default("active"),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});