import "server-only";
import { z } from "zod";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getCurrentMainAdviser } from "@/lib/auth/main-adviser";
import { readAdviserGroups, readEligibleGroupStudents } from "@/lib/repositories/adviser-groups.repository";
import { findResearchGroupById } from "@/lib/repositories/research-group.repository";
import { addGroupMember, removeGroupMember } from "./group-member.services";

export async function requireActiveGroupAdviser() {
    const session = await requireRole([ROLE_IDS.ADVISER]);
    return getCurrentMainAdviser(session.userId);
}

export async function getAdviserGroupsDirectory() {
    const account = await requireActiveGroupAdviser();
    if (!account) return null;
    try {
        const groups = await readAdviserGroups(account.userId);
        return await getCurrentMainAdviser(account.userId) ? { email: account.email, groups } : null;
    }
    catch { return null; }
}

const memberInput = z.object({ groupId: z.number().int().positive().safe(), userId: z.number().int().positive().safe() });

export async function getEligibleGroupStudents(groupId: number) {
    const account = await requireActiveGroupAdviser();
    if (!account || !z.number().int().positive().safe().safeParse(groupId).success) return null;
    const group = await findResearchGroupById(groupId);
    if (!group) return null;
    return group.status === "active" ? readEligibleGroupStudents(groupId, account.userId) : [];
}

export async function mutateAdviserGroupMember(operation: "add" | "remove", groupId: number, userId: number) {
    const account = await requireActiveGroupAdviser();
    if (!account || !memberInput.safeParse({ groupId, userId }).success) return { success: false, message: "This membership request is not permitted." };
    const group = await findResearchGroupById(groupId);
    if (!group) return { success: false, message: "This research group is not available." };
    // The underlying service independently resolves the actor and locks authority/eligibility.
    return operation === "add" ? addGroupMember(groupId, userId) : removeGroupMember(groupId, userId);
}
