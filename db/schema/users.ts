import{
    pgTable,
    serial,
    varchar,
    integer,
    timestamp,
    boolean,
} from "drizzle-orm/pg-core";

import { role } from "./role";

export const users = pgTable("users", {
    id: serial("id").primaryKey(),

    firstName: varchar("first_name", { length: 100 }).notNull(),

    lastName: varchar("last_name", { length: 100 }).notNull(),

    email: varchar("email", { length: 255 }).notNull().unique(),

    password: varchar("password", { length: 255 }).notNull(),

    roleId: integer("role_id")
        .references(() => role.id)
        .notNull(),
    
    // For storing profile image URL to firebase (future implementation)
    profileImage: varchar("profile_image", { length: 500 }),

    isActive: boolean("is_active").default(true).notNull(),

    // Last successful login timestamp (future implementation)
    lastLogin: timestamp("last_login"),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});