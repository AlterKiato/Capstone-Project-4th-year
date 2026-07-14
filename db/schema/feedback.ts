import {
    pgTable,
    serial,
    integer,
    text,
    timestamp,
    varchar,
} from "drizzle-orm/pg-core";

import { submissions } from "./submission";
import { users } from "./users";

export const feedbacks = pgTable("feedbacks", {
    id: serial("id").primaryKey(),

    submissionId: integer("submission_id")
        .references(() => submissions.id)
        .notNull(),
    
    teacherId: integer("teacher_id")
        .references(() => users.id)
        .notNull(),
    
    comments: text("comments").notNull(),

    decision: varchar("decision", { length: 30 })
        .default("Revision Required")
        .notNull(),
    
    createdAt: timestamp("created_at")
        .defaultNow()  
        .notNull(),
});