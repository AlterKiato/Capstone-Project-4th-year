import "server-only";
import { z } from "zod";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getCurrentMainAdviser } from "@/lib/auth/main-adviser";
import { findGroupMembersByGroupId, withMainGroupMemberScope } from "@/lib/repositories/group-member.repository";
import { findResearchGroupById } from "@/lib/repositories/research-group.repository";
import type { ServiceResult } from "@/types/auth";

export interface ManagedGroupMember { id: number; groupId: number; userId: number; joinedAt: Date; }
const id = z.number().int().positive().max(2147483647);
const input = z.object({ groupId: id, userId: id });
const denied = { success: false, message: "Current Main Research Adviser authority is required." } as const;

export async function getGroupMembers(groupId: number): Promise<ServiceResult<ManagedGroupMember[]>> {
    const actor = await getCurrentMainAdviser();
    if (!actor || !id.safeParse(groupId).success) return denied;
    if (!await findResearchGroupById(groupId)) return { success: false, message: "Research group not found." };
    const members = await findGroupMembersByGroupId(groupId);
    if (!await getCurrentMainAdviser(actor.userId)) return denied;
    return { success: true, message: "Group members retrieved successfully.", data: members };
}

async function changeMainGroupMember(operation: "add" | "remove", groupId: number, userId: number): Promise<ServiceResult<ManagedGroupMember>> {
    const actor = await getCurrentMainAdviser();
    if (!actor || !input.safeParse({ groupId, userId }).success) return denied;
    const result = await withMainGroupMemberScope(actor.userId, groupId, userId, async scope => {
        const group = scope.groups.find(item => item.id === groupId);
        if (!group) return { success: false, message: "Research group not found." };
        const existing = scope.memberships.find(member => member.groupId === groupId);
        if (operation === "remove") {
            if (!existing) return { success: false, message: "Student is not a member of this research group." };
            await scope.remove();
            return { success: true, message: "Student removed from research group successfully." };
        }
        const student = scope.accounts.find(account => account.id === userId);
        if (!student || student.roleId !== ROLE_IDS.STUDENT) return { success: false, message: "Only Student users can be added to research groups." };
        if (group.status !== "active") return { success: false, message: "Students can only be added to active research groups." };
        if (existing) return { success: false, message: "Student is already a member of this research group." };
        const active = scope.groups.find(item => item.id !== groupId && item.status === "active");
        if (active) return { success: false, message: `Student is already assigned to the active research group "${active.groupName}".` };
        return { success: true, message: "Student added to research group successfully.", data: await scope.add() };
    });
    return result ?? denied;
}

export async function addGroupMember(groupId: number, userId: number): Promise<ServiceResult<ManagedGroupMember>> {
    return changeMainGroupMember("add", groupId, userId);
}

export async function removeGroupMember(groupId: number, userId: number): Promise<ServiceResult> {
    const result = await changeMainGroupMember("remove", groupId, userId);
    return { success: result.success, message: result.message };
}
