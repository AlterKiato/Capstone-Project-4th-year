// Database layer for research group member operations.

import { db } from "@/lib/db";
import { lockCurrentMainAdviser } from "./research-supervision.repository";

import {
    groupMembers,
    researchGroups,
} from "@/db/schema";

import {
    and,
    asc,
    eq,
    inArray,
} from "drizzle-orm";

export type MainGroupMemberScope = {
    accounts: NonNullable<Awaited<ReturnType<typeof lockCurrentMainAdviser>>>;
    groups: (typeof researchGroups.$inferSelect)[];
    memberships: (typeof groupMembers.$inferSelect)[];
    add(): Promise<typeof groupMembers.$inferSelect>;
    remove(): Promise<void>;
};

/** Hold authority/Student/group locks while the service checks eligibility and mutates. */
export async function withMainGroupMemberScope<T>(actorId: number, groupId: number, userId: number, operation: (scope: MainGroupMemberScope) => Promise<T>) {
    return db.transaction(async tx => {
        const accounts = await lockCurrentMainAdviser(tx, actorId, [userId]);
        if (!accounts) return null;
        const memberships = await tx.select().from(groupMembers).where(eq(groupMembers.userId, userId));
        const groups = await tx.select().from(researchGroups)
            .where(inArray(researchGroups.id, [...new Set([groupId, ...memberships.map(member => member.groupId)])]))
            .orderBy(asc(researchGroups.id)).for("share");
        return operation({ accounts, groups, memberships,
            add: async () => {
                const [member] = await tx.insert(groupMembers).values({ groupId, userId }).returning();
                if (!member) throw new Error("Membership change could not be confirmed.");
                return member;
            },
            remove: async () => { await tx.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))); },
        });
    });
}

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
