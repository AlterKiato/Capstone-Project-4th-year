"use server";

import { revalidatePath } from "next/cache";
import { getDashboardAccount } from "@/lib/services/dashboard-account.service";

import {
    requireRole,
} from "@/lib/auth/authorization";

import {
    ROLE_IDS,
} from "@/lib/auth/roles";

import {
    createStudentResearch,
} from "@/lib/services/student-research.service";

import {
    createStudentResearchSchema,
} from "@/lib/validations/student-research";

/**
 * Creates a research project for the
 * currently authenticated Student.
 *
 * The Student ID comes from the authentication
 * session and is never accepted from the form.
 */
export async function createStudentResearchAction(
    formData: FormData
): Promise<{ success: boolean; message: string; projectId?: number }> {
    const session =
        await requireRole([
            ROLE_IDS.STUDENT,
        ]);

    const account = await getDashboardAccount();
    if (!account || account.roleId !== ROLE_IDS.STUDENT) return { success: false, message: "Your account access could not be verified." };
    const parsed =
        createStudentResearchSchema.safeParse({
            groupId:
                formData.get("groupId"),

            title:
                formData.get("title"),

            abstract:
                formData.get("abstract"),

            category:
                formData.get("category"),

            keywords:
                formData.get("keywords"),
        });

    if (!parsed.success) {
        return { success: false, message: "Check the required group, title and abstract, and the field length limits." };
    }

    let result;
    try { result = await createStudentResearch(
            parsed.data,
            session.userId
        ); } catch { return { success: false, message: "The research project could not be created. Please try again." }; }

    if (!result.success) {
        return { success: false, message: "The research project could not be created. Check your group assignment and try again." };
    }

    try { revalidatePath(
        "/dashboard/student"
    );

    revalidatePath("/dashboard/student/submissions");

    revalidatePath(
        "/dashboard/adviser"
    );

    revalidatePath(
        "/dashboard/adviser/groups"
    );
    } catch { return { success: true, message: "Research project created. Reload to view it.", projectId: result.data?.id }; }
    return { success: true, message: "Research project created successfully.", projectId: result.data?.id };
}
