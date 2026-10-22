import { sql } from "drizzle-orm";
import { pgTable, uuid, integer, varchar, timestamp, unique, index, check } from "drizzle-orm/pg-core";
import { users } from "./users";
import { researchPapers } from "./research-paper";
import { submissions } from "./submission";

export const submissionUploadIntents = pgTable("submission_upload_intents", {
    id: uuid("id").primaryKey(),
    studentId: integer("student_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    paperId: integer("paper_id").notNull().references(() => researchPapers.id, { onDelete: "restrict" }),
    requestKey: uuid("request_key").notNull(),
    stagingPath: varchar("staging_path", { length: 500 }).notNull().unique(),
    fileName: varchar("file_name", { length: 144 }).notNull(),
    declaredSize: integer("declared_size").notNull(),
    remarks: varchar("remarks", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    capabilityExpiresAt: timestamp("capability_expires_at", { withTimezone: true }),
    state: varchar("state", { length: 12 }).$type<"pending" | "completed" | "cancelled" | "rejected">().notNull().default("pending"),
    submissionId: integer("submission_id").unique().references(() => submissions.id, { onDelete: "restrict" }),
    finalPath: varchar("final_path", { length: 500 }).unique(),
    contentSha256: varchar("content_sha256", { length: 64 }),
}, table => [
    unique("upload_intent_student_request_unique").on(table.studentId, table.requestKey),
    index("upload_intent_student_created_idx").on(table.studentId, table.createdAt),
    index("upload_intent_expiry_id_idx").on(table.expiresAt, table.id),
    check("upload_intent_size_check", sql`${table.declaredSize} between 1 and 10485760`),
    check("upload_intent_time_check", sql`${table.expiresAt} > ${table.createdAt} and (${table.capabilityExpiresAt} is null or ${table.capabilityExpiresAt} > ${table.createdAt})`),
    check("upload_intent_state_check", sql`${table.state} in ('pending','completed','cancelled','rejected')`),
    check("upload_intent_completion_check", sql`(${table.state} = 'completed') = (${table.submissionId} is not null)`),
    check("upload_intent_plan_check", sql`((${table.finalPath} is null and ${table.contentSha256} is null) or (${table.finalPath} is not null and ${table.contentSha256} is not null and ${table.contentSha256} ~ '^[a-f0-9]{64}$')) and (${table.state} <> 'completed' or ${table.finalPath} is not null)`),
    check("upload_intent_staging_check", sql`${table.stagingPath} = 'staging/submissions/' || ${table.id}::text || '/upload.pdf'`),
    check("upload_intent_filename_check", sql`${table.fileName} ~ '^[a-zA-Z0-9_-]+[.]pdf$'`),
    check("upload_intent_final_check", sql`${table.finalPath} is null or ${table.finalPath} ~ ('^research/' || ${table.paperId}::text || '/v[1-9][0-9]*/' || ${table.id}::text || '-[a-zA-Z0-9_-]+[.]pdf$')`),
]);
