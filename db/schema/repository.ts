import {
    pgTable,
    serial,
    integer,
    boolean,
    timestamp,
    unique,
} from "drizzle-orm/pg-core";

import { researchPapers } from "./research-paper";

export const repositories = pgTable("repositories", {
    id: serial("id").primaryKey(),

    paperId: integer("paper_id")
        .references(() => researchPapers.id)
        .notNull(),
    
    isPublished: boolean("is_published")
        .default(false)
        .notNull(),
    
    publishedAt: timestamp("published_at"),

    downloadCount: integer("download_count")
        .default(0)
        .notNull(),
    
    viewCount: integer("view_count")
        .default(0)
        .notNull(),
}, (table) => ({
    paperIdUnique: unique("repositories_paper_id_unique").on(table.paperId),
}));
