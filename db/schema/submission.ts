import {
    pgTable,
    serial,
    integer,
    varchar,
    timestamp,
    unique,
} from "drizzle-orm/pg-core";

import { researchPapers } from "./research-paper";
import { users } from "./users";

export const submissions = pgTable(
    "submissions",
    {
        id: serial("id").primaryKey(),

        paperId: integer("paper_id")
            .references(() => researchPapers.id)
            .notNull(),

        submittedBy: integer("submitted_by")
            .references(() => users.id)
            .notNull(),

        version: varchar("version", {
            length: 20,
        }).notNull(),

        fileUrl: varchar("file_url", {
            length: 500,
        }).notNull(),

        remarks: varchar("remarks", {
            length: 500,
        }),

        status: varchar("status", {
            length: 30,
        })
            .default("Submitted")
            .notNull(),

        submittedAt: timestamp("submitted_at")
            .defaultNow()
            .notNull(),
    },
    (table) => ({
        paperVersionUnique: unique(
            "submissions_paper_version_unique"
        ).on(
            table.paperId,
            table.version
        ),
    })
);