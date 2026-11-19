import { sql } from "drizzle-orm";
import { pgTable, serial, integer, jsonb, timestamp, unique, check, uuid, boolean, text, primaryKey } from "drizzle-orm/pg-core";
import { submissions } from "./submission";
import { feedbacks } from "./feedback";
import { users } from "./users";
import type { EvaluationSnapshot } from "@/lib/submission-evaluation";

// Append-only generations, including clear tombstones, prevent ABA/stale-draft reuse.
export const submissionEvaluationAssignments = pgTable("submission_evaluation_assignments", {
    id: serial("id").primaryKey(),
    submissionId: integer("submission_id").notNull().references(() => submissions.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    assignedBy: integer("assigned_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    snapshot: jsonb("snapshot").$type<EvaluationSnapshot | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [unique("submission_evaluation_assignment_revision_unique").on(t.submissionId, t.revision),
    unique("submission_evaluation_assignment_id_submission_unique").on(t.id, t.submissionId),
    check("submission_evaluation_assignment_revision_check", sql`${t.revision} > 0`),
    check("submission_evaluation_snapshot_check", sql`${t.snapshot} is null or coalesce(jsonb_typeof(${t.snapshot}) = 'object'
        and jsonb_typeof(${t.snapshot}->'criteria') = 'array' and jsonb_array_length(${t.snapshot}->'criteria') between 1 and 30
        and jsonb_typeof(${t.snapshot}->'scale') = 'object' and char_length(${t.snapshot}->>'name') between 1 and 200, false)`)]);

// The assignment derives the exact submission; feedback is the existing official decision.
export const submissionEvaluations = pgTable("submission_evaluations", {
    id: serial("id").primaryKey(),
    assignmentId: integer("assignment_id").notNull().unique().references(() => submissionEvaluationAssignments.id, { onDelete: "restrict" }),
    feedbackId: integer("feedback_id").notNull().unique().references(() => feedbacks.id, { onDelete: "restrict" }),
    earned: integer("earned").notNull(), possible: integer("possible").notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [check("submission_evaluation_points_check", sql`${t.earned} >= 0 and ${t.possible} >= ${t.earned} and ${t.possible} <= 150`)]);

export const submissionEvaluationItems = pgTable("submission_evaluation_items", {
    evaluationId: integer("evaluation_id").notNull().references(() => submissionEvaluations.id, { onDelete: "restrict" }),
    criterionKey: uuid("criterion_key").notNull(), rating: integer("rating"),
    na: boolean("na").notNull(), reason: text("reason").notNull(), comment: text("comment").notNull(),
}, t => [primaryKey({ columns: [t.evaluationId, t.criterionKey] }),
    check("submission_evaluation_item_check", sql`char_length(${t.comment}) <= 2000 and char_length(${t.reason}) <= 2000
        and ((${t.na} = true and ${t.rating} is null and ${t.reason} ~ '[^[:space:]]')
        or (${t.na} = false and ${t.rating} between 1 and 5 and ${t.rating} is not null and ${t.reason} = ''))`)]);
