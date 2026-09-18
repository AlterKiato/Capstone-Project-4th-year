"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

import {
    addGroupMember,
    removeGroupMember,
} from "@/lib/services/group-member.services";

import {
    findResearchGroupById,
} from "@/lib/repositories/research-group.repository";

/**
 * Adds a Student to an Adviser's research group.
 *
 * Only the Adviser who owns the group
 * can add members.
 */
export async function addGroupMemberAction(
    groupId: number,
    userId: number
): Promise<void> {
    const session = await requireRole([
        ROLE_IDS.ADVISER,
    ]);

    const group = await findResearchGroupById(
        groupId
    );

    if (!group) {
        return;
    }

    if (group.adviserId !== session.userId) {
        return;
    }

    const result = await addGroupMember(
        groupId,
        userId
    );

    if (!result.success) {
        return;
    }

    revalidatePath(
        "/dashboard/adviser/groups"
    );

    revalidatePath(
        `/dashboard/adviser/groups/${groupId}`
    );
}

/**
 * Removes a Student from an Adviser's
 * research group.
 *
 * Only the Adviser who owns the group
 * can remove members.
 */
export async function removeGroupMemberAction(
    groupId: number,
    userId: number
): Promise<void> {
    const session = await requireRole([
        ROLE_IDS.ADVISER,
    ]);

    const group = await findResearchGroupById(
        groupId
    );

    if (!group) {
        return;
    }

    if (group.adviserId !== session.userId) {
        return;
    }

    const result = await removeGroupMember(
        groupId,
        userId
    );

    if (!result.success) {
        return;
    }

    revalidatePath(
        "/dashboard/adviser/groups"
    );

    revalidatePath(
        `/dashboard/adviser/groups/${groupId}`
    );
}