import { pgTable, serial, varchar} from "drizzle-orm/pg-core";

export const role = pgTable("role", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
});