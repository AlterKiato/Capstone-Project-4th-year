import {
    createResearchPaper,
    findResearchPaperById,
    findResearchPapersByGroupId,
} from "@/lib/repositories/research-paper.repository";

import {
    findResearchGroupById,
} from "@/lib/repositories/research-group.repository";

import {
    findGroupsByUserId,
    findGroupMember,
} from "@/lib/repositories/group-member.repository";

import {
    findUserById,
} from "@/lib/repositories/user.repository";

import {
    ROLE_IDS,
} from "@/lib/auth/roles";

import type {
    ServiceResult,
} from "@/types/auth";

/**
 * Represents the information required
 * to create a Student research project.
 */
export interface CreateStudentResearchInput {
    groupId: number;
    title: string;
    abstract: string;
    category?: string;
    keywords?: string;
}

/**
 * Represents a research project created
 * by a Student.
 */
export interface StudentResearchProject {
    id: number;
    groupId: number;
    title: string;
    abstract: string;
    category: string | null;
    keywords: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Represents a research group available
 * to a Student.
 */
export interface StudentResearchGroup {
    id: number;
    groupName: string;
    strand: string;
    section: string;
    schoolYear: string;
    adviserId: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Retrieves all research groups to which
 * the currently authenticated Student belongs.
 */
export async function getStudentResearchGroups(
    studentId: number
): Promise<
    ServiceResult<StudentResearchGroup[]>
> {
    const student =
        await findUserById(
            studentId
        );

    if (!student) {
        return {
            success: false,
            message: "Student account not found.",
        };
    }

    if (
        student.roleId !==
        ROLE_IDS.STUDENT
    ) {
        return {
            success: false,
            message:
                "Only Student users can access Student research groups.",
        };
    }

    const groups =
        await findGroupsByUserId(
            studentId
        );

    const activeGroups =
        groups.filter(
            (group) =>
                group.status === "active"
        );

    return {
        success: true,
        message:
            "Student research groups retrieved successfully.",
        data: activeGroups,
    };
}

/**
 * Retrieves all research projects belonging
 * to the research groups of a Student.
 *
 * Only research projects from the Student's
 * own active research groups are returned.
 */
export async function getStudentResearchProjects(
    studentId: number
): Promise<ServiceResult<StudentResearchProject[]>> {
    const groupsResult =
        await getStudentResearchGroups(
            studentId
        );

    if (!groupsResult.success) {
        return {
            success: false,
            message: groupsResult.message,
        };
    }

    const groups =
        groupsResult.data ?? [];

    if (groups.length === 0) {
        return {
            success: true,
            message:
                "No active research groups found.",
            data: [],
        };
    }

    const projects: StudentResearchProject[] =
        [];

    for (const group of groups) {
        const groupProjects =
            await findResearchPapersByGroupId(
                group.id
            );

        projects.push(
            ...groupProjects
        );
    }

    return {
        success: true,
        message:
            "Student research projects retrieved successfully.",
        data: projects,
    };
}

/**
 * Creates a research project for a Student.
 *
 * The service verifies that:
 *
 * 1. The Student exists.
 * 2. The Student has the Student role.
 * 3. The selected research group exists.
 * 4. The Student belongs to the selected group.
 *
 * The research project is initially created
 * with a Draft status.
 */
export async function createStudentResearch(
    data: CreateStudentResearchInput,
    studentId: number
): Promise<
    ServiceResult<StudentResearchProject>
> {
    const student =
        await findUserById(
            studentId
        );

    if (!student) {
        return {
            success: false,
            message: "Student account not found.",
        };
    }

    if (
        student.roleId !==
        ROLE_IDS.STUDENT
    ) {
        return {
            success: false,
            message:
                "Only Student users can create research projects.",
        };
    }

    const group =
        await findResearchGroupById(
            data.groupId
        );

    if (!group) {
        return {
            success: false,
            message:
                "Research group not found.",
        };
    }

    if (group.status !== "active") {
        return {
            success: false,
            message:
                "Research group is not currently active.",
        };
    }

    const membership =
        await findGroupMember(
            data.groupId,
            studentId
        );

    if (!membership) {
        return {
            success: false,
            message:
                "Student is not a member of the selected research group.",
        };
    }

    if (!data.title.trim()) {
        return {
            success: false,
            message:
                "Research title is required.",
        };
    }

    if (!data.abstract.trim()) {
        return {
            success: false,
            message:
                "Research abstract is required.",
        };
    }

    const research =
        await createResearchPaper({
            groupId: data.groupId,
            title: data.title.trim(),
            abstract: data.abstract.trim(),
            category:
                data.category?.trim() ||
                null,
            keywords:
                data.keywords?.trim() ||
                null,
            status: "Draft",
        });

    return {
        success: true,
        message:
            "Research project created successfully.",
        data: research,
    };
}

/**
 * Retrieves a research project after
 * verifying that the Student belongs
 * to its research group.
 */
export async function getStudentResearch(
    paperId: number,
    studentId: number
): Promise<
    ServiceResult<StudentResearchProject>
> {
    const research =
        await findResearchPaperById(
            paperId
        );

    if (!research) {
        return {
            success: false,
            message:
                "Research project not found.",
        };
    }

    const membership =
        await findGroupMember(
            research.groupId,
            studentId
        );

    if (!membership) {
        return {
            success: false,
            message:
                "Student does not belong to this research group.",
        };
    }

    return {
        success: true,
        message:
            "Research project retrieved successfully.",
        data: research,
    };
}