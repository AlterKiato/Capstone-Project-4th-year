"use server";

import { revalidatePath } from "next/cache";

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
): Promise<void> {
    const session =
        await requireRole([
            ROLE_IDS.STUDENT,
        ]);

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
        return;
    }

    const result =
        await createStudentResearch(
            parsed.data,
            session.userId
        );

    if (!result.success) {
        return;
    }

    revalidatePath(
        "/dashboard/student"
    );

    revalidatePath(
        "/dashboard/student/research"
    );

    revalidatePath(
        "/dashboard/adviser"
    );

    revalidatePath(
        "/dashboard/adviser/groups"
    );
}