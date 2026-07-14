import {
    pgTable,
    serial,
    integer,
    boolean,
    timestamp,
} from "drizzle-orm/pg-core";

import { researchGroups } from "./research-group";
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
});