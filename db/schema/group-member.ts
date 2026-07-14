import {
    pgTable,
    serial,
    integer,
    timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./users";
import { researchGroups } from "./research-group";

export const groupMembers = pgTable("group_members", {
    id: serial("id").primaryKey(),
    
    groupId: integer("group_id")
        .notNull()
        .references(() => researchGroups.id),

    userId: integer("user_id")
        .notNull()
        .references(() => users.id),

    joinedAt: timestamp("joined_at").defaultNow().notNull(),
});