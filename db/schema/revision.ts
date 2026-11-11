import { sql } from "drizzle-orm";
import { pgTable, serial, integer, text, varchar, timestamp, unique, check, index } from "drizzle-orm/pg-core";
import { feedbacks } from "./feedback";
import { submissions } from "./submission";
import { users } from "./users";

// Inserted only with the official Revision Required decision. No edit/delete runtime grant.
export const revisionItems = pgTable("revision_items", {
    id: serial("id").primaryKey(),
    feedbackId: integer("feedback_id").notNull().references(() => feedbacks.id, { onDelete: "restrict" }),
    correction: text("correction").notNull(),
    reference: varchar("reference", { length: 120 }).notNull().default(""),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
    unique("revision_items_feedback_position_unique").on(t.feedbackId, t.position),
    check("revision_items_correction_check", sql`char_length(${t.correction}) between 1 and 2000 and ${t.correction} ~ '[^[:space:]]'`),
    check("revision_items_position_check", sql`${t.position} between 0 and 29`),
]);

// One response per Student/item. Group members cannot overwrite each other's work.
export const revisionResponses = pgTable("revision_responses", {
    id: serial("id").primaryKey(),
    itemId: integer("item_id").notNull().references(() => revisionItems.id, { onDelete: "restrict" }),
    studentId: integer("student_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    actionTaken: text("action_taken").notNull().default(""),
    revision: integer("revision").notNull().default(1),
    frozenBySubmissionId: integer("frozen_by_submission_id").references(() => submissions.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
    unique("revision_responses_item_student_unique").on(t.itemId, t.studentId),
    index("revision_responses_student_item_idx").on(t.studentId, t.itemId),
    check("revision_responses_action_check", sql`char_length(${t.actionTaken}) <= 2000`),
    check("revision_responses_revision_check", sql`${t.revision} > 0`),
]);
