import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";
import { submissions } from "./submission";
import { submissionEvaluationAssignments } from "./submission-evaluation";
import type { CoAssessment } from "@/lib/co-evaluation";

export const mainAdviserDesignation = pgTable("main_adviser_designation", {
    id: integer("id").primaryKey().default(1),
    mainAdviserId: integer("main_adviser_id").references(() => users.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull().default(0),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
    check("main_adviser_singleton_check", sql`${table.id} = 1`),
    check("main_adviser_revision_check", sql`${table.revision} >= 0`),
    check("main_adviser_configuration_check", sql`(
        ${table.mainAdviserId} is null and ${table.updatedBy} is null and ${table.revision} = 0
    ) or (${table.mainAdviserId} is not null and ${table.updatedBy} is not null and ${table.revision} > 0)`),
]);

// Persistence only in S3.1. No assignment actions, reads or document permissions.
export const coAdviserReviewAssignments = pgTable("co_adviser_review_assignments", {
    id: serial("id").primaryKey(),
    submissionId: integer("submission_id").notNull().references(() => submissions.id, { onDelete: "restrict" }),
    coAdviserId: integer("co_adviser_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    assignedBy: integer("assigned_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    state: varchar("state", { length: 20 }).notNull().default("open"),
    recommendation: text("recommendation"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: integer("closed_by").references(() => users.id, { onDelete: "restrict" }),
    closureReason: varchar("closure_reason", { length: 100 }),
    evaluationAssignmentId: integer("evaluation_assignment_id"),
    evaluation: jsonb("evaluation").$type<CoAssessment>(),
}, table => [
    foreignKey({ name: "co_recommendation_exact_evaluation_fk", columns: [table.evaluationAssignmentId, table.submissionId],
        foreignColumns: [submissionEvaluationAssignments.id, submissionEvaluationAssignments.submissionId] }).onDelete("restrict"),
    check("co_recommendation_evaluation_check", sql`(${table.evaluationAssignmentId} is null and ${table.evaluation} is null) or
        (${table.evaluationAssignmentId} is not null and ${table.evaluation} is not null and ${table.state} in ('completed','closed')
        and coalesce(jsonb_typeof(${table.evaluation}) = 'object' and ${table.evaluation}->'version' = '1'::jsonb
        and jsonb_typeof(${table.evaluation}->'items') = 'array' and jsonb_array_length(${table.evaluation}->'items') between 1 and 30
        and (${table.evaluation}->>'earned')::integer between 1 and 150
        and (${table.evaluation}->>'possible')::integer between (${table.evaluation}->>'earned')::integer and 150
        and octet_length(${table.evaluation}::text) <= 1048576, false))`),
    uniqueIndex("co_adviser_open_assignment_unique").on(table.submissionId, table.coAdviserId).where(sql`${table.state} = 'open'`),
    index("co_adviser_assignment_inbox_idx").on(table.coAdviserId, table.state, table.submissionId),
    check("co_adviser_distinct_actor_check", sql`${table.coAdviserId} <> ${table.assignedBy}`),
    check("co_adviser_recommendation_check", sql`${table.recommendation} is null or (
        char_length(${table.recommendation}) between 1 and 20000 and ${table.recommendation} ~ '[^[:space:]]')`),
    check("co_adviser_lifecycle_check", sql`(
        ${table.state} = 'open' and ${table.recommendation} is null and ${table.completedAt} is null
        and ${table.closedAt} is null and ${table.closedBy} is null and ${table.closureReason} is null
    ) or (
        ${table.state} = 'completed' and ${table.recommendation} is not null and ${table.completedAt} is not null
        and ${table.completedAt} >= ${table.createdAt} and ${table.closedAt} is null
        and ${table.closedBy} is null and ${table.closureReason} is null
    ) or (
        ${table.state} = 'closed' and ${table.closedAt} is not null and ${table.closedAt} >= ${table.createdAt}
        and ${table.closureReason} is not null and ${table.closureReason} ~ '[^[:space:]]'
        and ((${table.recommendation} is null and ${table.completedAt} is null)
            or (${table.recommendation} is not null and ${table.completedAt} is not null
                and ${table.completedAt} >= ${table.createdAt} and ${table.completedAt} <= ${table.closedAt}))
    )`),
]);
