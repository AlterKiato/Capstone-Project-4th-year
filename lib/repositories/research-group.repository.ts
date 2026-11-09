// Database layer for research group CRUD operations.

import { db } from "@/lib/db";
import { activityLogs, researchGroups, users } from "@/db/schema";
import { currentMainAdviserPredicate, lockCurrentMainAdviser } from "./research-supervision.repository";

import { desc, eq } from "drizzle-orm";

/**
 * Retrieves all research groups.
 *
 * Groups are ordered from newest to oldest.
 */
export async function findAllResearchGroups() {
    return db
        .select({
            id: researchGroups.id,
            groupName: researchGroups.groupName,
            strand: researchGroups.strand,
            section: researchGroups.section,
            schoolYear: researchGroups.schoolYear,
            adviserId: researchGroups.adviserId,
            status: researchGroups.status,
            createdAt: researchGroups.createdAt,
            updatedAt: researchGroups.updatedAt,
        })
        .from(researchGroups)
        .orderBy(desc(researchGroups.createdAt), desc(researchGroups.id));
}

/**
 * Retrieves a research group using its ID.
 */
export async function findResearchGroupById(
    id: number
) {
    return db.query.researchGroups.findFirst({
        where: eq(researchGroups.id, id),
    });
}

/**
 * Creates a new research group.
 */
export async function createResearchGroup(
    data: typeof researchGroups.$inferInsert
) {
    const [group] = await db
        .insert(researchGroups)
        .values(data)
        .returning();

    return group;
}

export async function findResearchGroupsForMainAdviser(adviserId: number) {
    return db.select().from(researchGroups).where(currentMainAdviserPredicate(adviserId));
}

export async function createResearchGroupForMainAdviser(data: Omit<typeof researchGroups.$inferInsert, "adviserId">, actorId: number) {
    return db.transaction(async tx => {
        if (!await lockCurrentMainAdviser(tx, actorId)) return null;
        const [group] = await tx.insert(researchGroups).values({ ...data, adviserId: actorId }).returning();
        if (!group) throw new Error("Research group creation could not be confirmed.");
        await tx.insert(activityLogs).values({ userId: actorId, action: "Research Group Created", description: `Created research group "${group.groupName}".` });
        return group;
    });
}

/**
 * Updates the status of a research group.
 */
export async function updateResearchGroupStatusForAdmin(
    actorId: number,
    id: number,
    status: "active" | "archived"
) {
    // Like Slice B, hold the actor row lock until the privileged write commits.
    // Revocation which acquires that lock first is observed before any group write.
    return db.transaction(async tx => {
        const [actor] = await tx.select({ roleId: users.roleId, isActive: users.isActive })
            .from(users).where(eq(users.id, actorId)).for("update");
        if (!actor?.isActive || actor.roleId !== 1) return { kind: "denied" } as const;
        const [existing] = await tx.select().from(researchGroups).where(eq(researchGroups.id, id)).for("update");
        if (!existing) return { kind: "missing" } as const;
        // Preserve the legacy target-status allowlist, including repeated requests.
        // Duplicate prevention belongs to the pending UI lock, not a new lifecycle rule.
        if (status !== "active" && status !== "archived")
            return { kind: "invalid" } as const;
        const [group] = await tx.update(researchGroups).set({ status, updatedAt: new Date() })
            .where(eq(researchGroups.id, id)).returning();
        return group ? { kind: "updated", group } as const : { kind: "missing" } as const;
    });
}

/**
 * Retrieves all research groups assigned
 * to a specific adviser.
 */
export async function findResearchGroupsByAdviserId(
    adviserId: number
) {
    return db.query.researchGroups.findMany({
        where: eq(
            researchGroups.adviserId,
            adviserId
        ),
    });
}
