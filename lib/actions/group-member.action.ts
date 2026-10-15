"use server";
import { revalidatePath } from "next/cache";
import { getEligibleGroupStudents, mutateAdviserGroupMember } from "@/lib/services/adviser-groups.service";

export async function eligibleGroupStudentsAction(groupId: number) {
    try {
        const data = await getEligibleGroupStudents(groupId);
        return data ? { success: true, message: "", data } : { success: false, message: "Students could not be retrieved." };
    } catch { return { success: false, message: "Students could not be retrieved. Close this dialog and try again." }; }
}

async function mutate(operation: "add" | "remove", groupId: number, userId: number) {
    try {
        const result = await mutateAdviserGroupMember(operation, groupId, userId);
        if (result.success) {
            revalidatePath("/dashboard/adviser/groups");
            revalidatePath(`/dashboard/adviser/groups/${groupId}`);
            revalidatePath("/dashboard/adviser");
        }
        return { success: result.success, message: result.message };
    } catch { return { success: false, message: "The membership change could not be confirmed. Reload to check the current members before retrying." }; }
}

export async function addGroupMemberAction(groupId: number, userId: number) {
    return mutate("add", groupId, userId);
}

export async function removeGroupMemberAction(groupId: number, userId: number) {
    return mutate("remove", groupId, userId);
}
