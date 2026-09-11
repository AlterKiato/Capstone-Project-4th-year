// Database layer for research group member operations.

import { db } from "@/lib/db";
import { groupMembers } from "@/db/schema";

import { and, eq } from "drizzle-orm";

/**
 * Retrieves all members belonging to a research group.
 */
export async function findGroupMembersByGroupId(
    groupId: number
) {
    return db.query.groupMembers.findMany({
        where: eq(groupMembers.groupId, groupId),
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
        where: (groupMembers, { and, eq }) =>
            and(
                eq(groupMembers.groupId, groupId),
                eq(groupMembers.userId, userId)
            ),
    });
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
                eq(groupMembers.groupId, groupId),
                eq(groupMembers.userId, userId)
            )
        )
        .returning();

    return member;
}