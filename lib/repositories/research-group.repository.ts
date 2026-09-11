// Database layer for research group CRUD operations.

import { db } from "@/lib/db";
import { researchGroups } from "@/db/schema";

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
        .orderBy(desc(researchGroups.createdAt));
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

/**
 * Updates the status of a research group.
 */
export async function updateResearchGroupStatus(
    id: number,
    status: string
) {
    const [group] = await db
        .update(researchGroups)
        .set({
            status,
            updatedAt: new Date(),
        })
        .where(eq(researchGroups.id, id))
        .returning();

    return group;
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