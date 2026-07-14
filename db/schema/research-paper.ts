import {
    pgTable,
    serial,
    varchar,
    text,
    integer,
    timestamp,
} from "drizzle-orm/pg-core";

import { researchGroups } from "./research-group";

export const researchPapers = pgTable("research_papers", {
    id: serial("id").primaryKey(),
    
    groupId: integer("group_id")
        .references(() => researchGroups.id)
        .notNull(),

    title: varchar("title", { length: 200 }).notNull(),

    abstract: text("abstract").notNull(),

    category: varchar("category", { length: 100 }),

    keywords: text("keywords"),

    status: varchar("status", { length: 20 }).default("Draft").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});