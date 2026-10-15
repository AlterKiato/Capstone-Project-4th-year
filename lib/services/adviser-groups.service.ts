import "server-only";
import { z } from "zod";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getDashboardAccount } from "./dashboard-account.service";
import { readAdviserGroups, readEligibleGroupStudents } from "@/lib/repositories/adviser-groups.repository";
import { findResearchGroupById } from "@/lib/repositories/research-group.repository";
import { addGroupMember, removeGroupMember } from "./group-member.services";

export async function requireActiveGroupAdviser() {
    const session = await requireRole([ROLE_IDS.ADVISER]);
    const account = await getDashboardAccount();
    if (!account || account.roleId !== ROLE_IDS.ADVISER || !Number.isSafeInteger(session.userId) || session.userId <= 0) return null;
    return { userId: session.userId, email: account.email };
}

export async function getAdviserGroupsDirectory() {
    const account = await requireActiveGroupAdviser();
    if (!account) return null;
    try { return { email: account.email, groups: await readAdviserGroups(account.userId) }; }
    catch { return null; }
}

const memberInput = z.object({ groupId: z.number().int().positive().safe(), userId: z.number().int().positive().safe() });

export async function getEligibleGroupStudents(groupId: number) {
    const account = await requireActiveGroupAdviser();
    if (!account || !z.number().int().positive().safe().safeParse(groupId).success) return null;
    const group = await findResearchGroupById(groupId);
    if (!group || group.adviserId !== account.userId) return null;
    return group.status === "active" ? readEligibleGroupStudents(groupId) : [];
}

export async function mutateAdviserGroupMember(operation: "add" | "remove", groupId: number, userId: number) {
    const account = await requireActiveGroupAdviser();
    if (!account || !memberInput.safeParse({ groupId, userId }).success) return { success: false, message: "This membership request is not permitted." };
    const group = await findResearchGroupById(groupId);
    if (!group || group.adviserId !== account.userId) return { success: false, message: "This research group is not available." };
    // Keep the existing eligibility/removal rules behind a service ownership boundary.
    return operation === "add" ? addGroupMember(groupId, userId) : removeGroupMember(groupId, userId);
}
