import { sql } from "drizzle-orm";
import { pgTable, serial, integer, varchar, text, date, timestamp, unique, index, check } from "drizzle-orm/pg-core";
import { researchPapers } from "./research-paper";
import { users } from "./users";

// C2 source foundation only. No corresponding migration has been generated or applied.
export const groupTasks = pgTable("group_tasks", {
    id: serial("id").primaryKey(),
    paperId: integer("paper_id").notNull().references(() => researchPapers.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    assignedStudentId: integer("assigned_student_id").references(() => users.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 16 }).$type<"To Do" | "In Progress" | "Done">().notNull().default("To Do"),
    dueDate: date("due_date", { mode: "string" }),
    createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
    unique("group_tasks_id_paper_unique").on(table.id, table.paperId),
    index("group_tasks_paper_created_id_idx").on(table.paperId, table.createdAt, table.id),
    check("group_tasks_title_check", sql`char_length(${table.title}) between 1 and 200 and ${table.title} ~ '[^[:space:]]'`),
    check("group_tasks_description_check", sql`${table.description} is null or char_length(${table.description}) <= 5000`),
    check("group_tasks_status_check", sql`${table.status} in ('To Do', 'In Progress', 'Done')`),
]);
