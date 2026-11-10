import { sql } from "drizzle-orm";
import { pgTable, serial, integer, varchar, date, timestamp, index, check, foreignKey } from "drizzle-orm/pg-core";
import { researchPapers } from "./research-paper";
import { submissions } from "./submission";
import { users } from "./users";

export const researchMilestones = pgTable("research_milestones", {
    id: serial("id").primaryKey(),
    paperId: integer("paper_id").notNull().references(() => researchPapers.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    submissionId: integer("submission_id"),
    verifiedBy: integer("verified_by").references(() => users.id, { onDelete: "restrict" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    revision: integer("revision").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
    foreignKey({ name: "research_milestones_submission_paper_fk", columns: [table.submissionId, table.paperId], foreignColumns: [submissions.id, submissions.paperId] }).onDelete("restrict"),
    index("research_milestones_paper_due_id_idx").on(table.paperId, table.dueDate, table.id),
    check("research_milestones_title_check", sql`char_length(${table.title}) between 1 and 200 and ${table.title} ~ '[^[:space:]]'`),
    check("research_milestones_revision_check", sql`${table.revision} >= 0`),
    check("research_milestones_verification_check", sql`(${table.verifiedBy} is null and ${table.verifiedAt} is null) or (${table.verifiedBy} is not null and ${table.verifiedAt} is not null and ${table.submissionId} is not null)`),
]);
