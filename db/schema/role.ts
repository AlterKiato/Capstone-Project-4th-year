import {
  pgTable,
  serial,
  varchar,
  timestamp,
  text,
} from "drizzle-orm/pg-core";

export const role = pgTable("role", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),


description: text("description"),

createdAt: timestamp("created_at")
  .defaultNow()
  .notNull(),
});