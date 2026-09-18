import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";

import { researchPapers } from "@/db/schema";

/**
 * Retrieves all research papers.
 *
 * Papers are ordered from newest to oldest.
 */
export async function findAllResearchPapers() {
    return await db
        .select()
        .from(researchPapers)
        .orderBy(
            desc(
                researchPapers.createdAt
            )
        );
}

/**
 * Retrieves all research papers belonging
 * to a specific research group.
 */
export async function findResearchPapersByGroupId(
    groupId: number
) {
    return await db
        .select()
        .from(researchPapers)
        .where(
            eq(
                researchPapers.groupId,
                groupId
            )
        )
        .orderBy(
            desc(
                researchPapers.createdAt
            )
        );
}

/**
 * Retrieves a research paper by its ID.
 */
export async function findResearchPaperById(
    id: number
) {
    const [paper] = await db
        .select()
        .from(researchPapers)
        .where(
            eq(
                researchPapers.id,
                id
            )
        );

    return paper;
}

/**
 * Creates a new research paper.
 */
export async function createResearchPaper(
    data: typeof researchPapers.$inferInsert
) {
    const [paper] = await db
        .insert(researchPapers)
        .values(data)
        .returning();

    return paper;
}

/**
 * Updates an existing research paper.
 */
export async function updateResearchPaper(
    id: number,
    data: Partial<
        typeof researchPapers.$inferInsert
    >
) {
    const [paper] = await db
        .update(researchPapers)
        .set({
            ...data,
            updatedAt: new Date(),
        })
        .where(
            eq(
                researchPapers.id,
                id
            )
        )
        .returning();

    return paper;
}

/**
 * Updates the status of a research paper.
 */
export async function updateResearchPaperStatus(
    id: number,
    status: string
) {
    const [paper] = await db
        .update(researchPapers)
        .set({
            status,
            updatedAt: new Date(),
        })
        .where(
            eq(
                researchPapers.id,
                id
            )
        )
        .returning();

    return paper;
}

/**
 * Deletes a research paper by its ID.
 */
export async function deleteResearchPaper(
    id: number
) {
    const [paper] = await db
        .delete(researchPapers)
        .where(
            eq(
                researchPapers.id,
                id
            )
        )
        .returning();

    return paper;
}