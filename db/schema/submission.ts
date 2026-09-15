import {
    pgTable,
    serial,
    integer,
    varchar,
    timestamp,
} from "drizzle-orm/pg-core";

import { researchPapers } from "./research-paper";
import { users } from "./users";

export const submissions = pgTable("submissions", {
    id: serial("id").primaryKey(),

    /**
     * The research paper this submission belongs to.
     */
    paperId: integer("paper_id")
        .references(() => researchPapers.id)
        .notNull(),

    /**
     * The student who submitted this version.
     */
    submittedBy: integer("submitted_by")
        .references(() => users.id)
        .notNull(),

    /**
     * Version label of the submitted research paper.
     *
     * Examples:
     * v1
     * v2
     * v3
     */
    version: varchar("version", {
        length: 20,
    }).notNull(),

    /**
     * File location.
     *
     * This will later store the Firebase
     * Storage URL.
     */
    fileUrl: varchar("file_url", {
        length: 500,
    }).notNull(),

    /**
     * Optional submission remarks.
     */
    remarks: varchar("remarks", {
        length: 500,
    }),

    /**
     * Submission workflow status.
     */
    status: varchar("status", {
        length: 30,
    })
        .default("Submitted")
        .notNull(),

    submittedAt: timestamp(
        "submitted_at"
    )
        .defaultNow()
        .notNull(),
});