import { sql } from "drizzle-orm";
import { pgTable, serial, integer, varchar, text, timestamp, foreignKey, index, check } from "drizzle-orm/pg-core";
import { researchPapers } from "./research-paper";
import { users } from "./users";
import { groupTasks } from "./group-task";

export const taskNotes = pgTable("task_notes", {
    id: serial("id").primaryKey(),
    paperId: integer("paper_id").notNull().references(() => researchPapers.id, { onDelete: "restrict" }),
    taskId: integer("task_id"),
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").notNull(),
    createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, table => [
    foreignKey({ name: "task_notes_task_paper_fk", columns: [table.taskId, table.paperId], foreignColumns: [groupTasks.id, groupTasks.paperId] }).onDelete("restrict"),
    index("task_notes_paper_updated_id_idx").on(table.paperId, table.updatedAt, table.id),
    index("task_notes_task_paper_idx").on(table.taskId, table.paperId),
    check("task_notes_title_check", sql`char_length(${table.title}) between 1 and 200 and ${table.title} ~ '[^[:space:]]'`),
    check("task_notes_content_check", sql`char_length(${table.content}) between 1 and 20000 and ${table.content} ~ '[^[:space:]]'`),
    check("task_notes_version_check", sql`${table.version} > 0`),
]);
