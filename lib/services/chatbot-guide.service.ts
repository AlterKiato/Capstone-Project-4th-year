import "server-only";
import { getSession } from "@/lib/auth/session";
import { ROLE_IDS } from "@/lib/auth/roles";
import { findUserById } from "@/lib/repositories/user.repository";
import { getRoleGuideTopics } from "@/lib/ai/guide-knowledge";
import { getGuideProviderNotice } from "@/lib/ai/guide-provider";
import { guideRequestSchema } from "@/lib/validations/chatbot-guide";
import type { GuideQuestion, GuideResult, GuideRole } from "@/types/chatbot-guide";

const unavailable = { success: false, mode: "unavailable", message: "System guidance is unavailable. Please contact your Admin for account or access assistance." } as const;
const unsupported = { success: false, mode: "unsupported", message: "That topic is unavailable for your role. Choose a supported guide question." } as const;

async function getVerifiedGuideRole(): Promise<GuideRole | null> {
    const session = await getSession();
    if (!session || !Number.isSafeInteger(session.userId) || session.userId <= 0 ||
        ![ROLE_IDS.ADMIN, ROLE_IDS.ADVISER, ROLE_IDS.STUDENT].some(role => role === session.roleId)) return null;
    const user = await findUserById(session.userId);
    if (!user?.isActive || user.roleId !== session.roleId) return null;
    return user.roleId as GuideRole;
}

export async function getGuideQuestions(): Promise<{ success: true; questions: GuideQuestion[] } | typeof unavailable> {
    try {
        const role = await getVerifiedGuideRole();
        if (!role) return unavailable;
        return { success: true, questions: getRoleGuideTopics(role).map(({ id, question }) => ({ id, question })) };
    } catch { return unavailable; }
}

export async function getGuideAnswer(input: unknown): Promise<GuideResult> {
    try {
        const role = await getVerifiedGuideRole();
        if (!role) return unavailable;
        const parsed = guideRequestSchema.safeParse(input);
        if (!parsed.success) return unsupported;
        const topic = getRoleGuideTopics(role).find(item => item.id === parsed.data.topicId);
        if (!topic) return unsupported;
        return { success: true, mode: "static", message: getGuideProviderNotice(), topic };
    } catch { return unavailable; }
}
