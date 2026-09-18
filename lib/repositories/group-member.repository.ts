// Database layer for research group member operations.

import { db } from "@/lib/db";

import {
    groupMembers,
    researchGroups,
} from "@/db/schema";

import {
    and,
    eq,
} from "drizzle-orm";

/**
 * Retrieves all members belonging
 * to a research group.
 */
export async function findGroupMembersByGroupId(
    groupId: number
) {
    return db.query.groupMembers.findMany({
        where: eq(
            groupMembers.groupId,
            groupId
        ),
    });
}

/**
 * Finds a specific group membership using
 * the research group ID and user ID.
 *
 * This helps prevent a user from being added
 * to the same group multiple times.
 */
export async function findGroupMember(
    groupId: number,
    userId: number
) {
    return db.query.groupMembers.findFirst({
        where: (
            groupMembers,
            { and, eq }
        ) =>
            and(
                eq(
                    groupMembers.groupId,
                    groupId
                ),
                eq(
                    groupMembers.userId,
                    userId
                )
            ),
    });
}

/**
 * Retrieves all research groups to which
 * a specific Student belongs.
 *
 * This is used by the Student dashboard
 * when selecting a research group for a
 * new research project.
 */
export async function findGroupsByUserId(
    userId: number
) {
    return db
        .select({
            id: researchGroups.id,
            groupName:
                researchGroups.groupName,
            strand:
                researchGroups.strand,
            section:
                researchGroups.section,
            schoolYear:
                researchGroups.schoolYear,
            adviserId:
                researchGroups.adviserId,
            status:
                researchGroups.status,
            createdAt:
                researchGroups.createdAt,
            updatedAt:
                researchGroups.updatedAt,
        })
        .from(groupMembers)
        .innerJoin(
            researchGroups,
            eq(
                groupMembers.groupId,
                researchGroups.id
            )
        )
        .where(
            eq(
                groupMembers.userId,
                userId
            )
        );
}

/**
 * Adds a user as a member of a research group.
 */
export async function createGroupMember(
    groupId: number,
    userId: number
) {
    const [member] = await db
        .insert(groupMembers)
        .values({
            groupId,
            userId,
        })
        .returning();

    return member;
}

/**
 * Removes a member from a research group.
 */
export async function deleteGroupMember(
    groupId: number,
    userId: number
) {
    const [member] = await db
        .delete(groupMembers)
        .where(
            and(
                eq(
                    groupMembers.groupId,
                    groupId
                ),
                eq(
                    groupMembers.userId,
                    userId
                )
            )
        )
        .returning();

    return member;
}