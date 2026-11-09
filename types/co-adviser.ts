export type DelegationResult<T = never> = { success: boolean; message: string; data?: T };
export type MainDelegationPanel = {
    eligible: boolean;
    advisers: { id: number; name: string; email: string }[];
    assignments: { id: number; coAdviserId: number; name: string; state: string; recommendation: string | null;
        createdAt: string; completedAt: string | null; closedAt: string | null; closureReason: string | null }[];
};
export type CoAssignment = { id: number; submissionId: number; title: string; version: string; state: string;
    groupId: number; recommendation: string | null;
    reviewAvailable: boolean; createdAt: string; completedAt: string | null; closedAt: string | null };
export type CoWorkspace = { email: string; assignments: CoAssignment[] };
export type RecommendationImport = { assignmentId: number; submissionId: number; text: string; author: string };
