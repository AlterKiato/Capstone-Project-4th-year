import { sql } from "drizzle-orm";
import { pgTable, serial, integer, varchar, text, timestamp, jsonb, uuid, boolean, primaryKey, unique, index, check } from "drizzle-orm/pg-core";
import { users } from "./users";
import type { TemplateScale } from "@/lib/evaluation-templates";

export const evaluationTemplates = pgTable("evaluation_templates", {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 200 }).notNull(),
    scale: jsonb("scale").$type<TemplateScale>().notNull(),
    revision: integer("revision").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
    index("evaluation_templates_owner_archive_id_idx").on(t.ownerId, t.archivedAt, t.id),
    check("evaluation_templates_name_check", sql`char_length(${t.name}) between 1 and 200 and ${t.name} ~ '[^[:space:]]'`),
    check("evaluation_templates_revision_check", sql`${t.revision} >= 0`),
    // Exact consecutive points are also validated by Zod. JSONPath avoids subqueries/functions in CHECKs.
    check("evaluation_templates_scale_check", sql`coalesce(
        jsonb_typeof(${t.scale}) = 'object' and ${t.scale}->'version' = '1'::jsonb
        and jsonb_typeof(${t.scale}->'levels') = 'array'
        and jsonb_array_length(${t.scale}->'levels') between 2 and 5
        and ${t.scale} #> '{levels,0,points}' = '1'::jsonb
        and ${t.scale} #> '{levels,1,points}' = '2'::jsonb
        and (jsonb_array_length(${t.scale}->'levels') < 3 or ${t.scale} #> '{levels,2,points}' = '3'::jsonb)
        and (jsonb_array_length(${t.scale}->'levels') < 4 or ${t.scale} #> '{levels,3,points}' = '4'::jsonb)
        and (jsonb_array_length(${t.scale}->'levels') < 5 or ${t.scale} #> '{levels,4,points}' = '5'::jsonb)
        and not jsonb_path_exists(${t.scale}, '$.levels[*] ? (@.label.type() != "string" || @.label == "" || @.description.type() != "string")')
        and jsonb_array_length(jsonb_path_query_array(${t.scale}, '$.levels[*].label')) = jsonb_array_length(${t.scale}->'levels')
        and jsonb_array_length(jsonb_path_query_array(${t.scale}, '$.levels[*].description')) = jsonb_array_length(${t.scale}->'levels')
    , false)`),
]);

export const evaluationTemplateCriteria = pgTable("evaluation_template_criteria", {
    templateId: integer("template_id").notNull().references(() => evaluationTemplates.id, { onDelete: "restrict" }),
    key: uuid("criterion_key").notNull(),
    position: integer("position").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description").notNull().default(""),
    allowsNa: boolean("allows_na").notNull().default(false),
}, t => [
    primaryKey({ columns: [t.templateId, t.key] }),
    unique("evaluation_template_criteria_position_unique").on(t.templateId, t.position),
    check("evaluation_template_criteria_position_check", sql`${t.position} between 0 and 29`),
    check("evaluation_template_criteria_name_check", sql`char_length(${t.name}) between 1 and 200 and ${t.name} ~ '[^[:space:]]'`),
    check("evaluation_template_criteria_description_check", sql`char_length(${t.description}) <= 2000`),
]);
