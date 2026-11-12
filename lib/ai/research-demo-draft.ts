import { RESEARCH_DEMO_QUESTIONS, RESEARCH_DEMO_FOLLOWUPS, getResearchDemoAnswer, type ResearchDemoTask } from "@/lib/ai/adviser-research-demo";
import { researchDemoDraftSchema, researchDemoRecoveryContextSchema, type ResearchDemoRecoveryContext, type ResearchDemoQuestionId } from "@/lib/validations/research-demo-draft";
import { researchDemoAnswerSchema, type ResearchDemoAnswer } from "@/lib/validations/adviser-research-assistant";

export type SyntheticExchange = { question: string; answer: ResearchDemoAnswer };
export const RESEARCH_DEMO_DRAFT_PREFIX = "thesishs:research-demo:";
export const RESEARCH_DEMO_DRAFT_CLEAR_EVENT = "research-demo-drafts-cleared";
export const RESEARCH_DEMO_DRAFT_TTL = 2 * 60 * 60 * 1000;
const ownerKey = RESEARCH_DEMO_DRAFT_PREFIX + "owner";
function storage(): Storage | null { try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; } }
export function researchDemoDraftKey(context: ResearchDemoRecoveryContext) {
    const parsed = researchDemoRecoveryContextSchema.parse(context);
    return `${RESEARCH_DEMO_DRAFT_PREFIX}v1:${parsed.accountId}:${parsed.authority}:${parsed.authority === "co" ? parsed.assignmentId : "main"}:${parsed.submissionId}:${parsed.version}`;
}
export function removeResearchDemoDraft(context: ResearchDemoRecoveryContext | null) {
    try { if (context) storage()?.removeItem(researchDemoDraftKey(context)); } catch { /* Unavailable storage preserves memory-only use. */ }
}
// Feature namespace only; explicit logout never clears unrelated browser-session data.
export function clearResearchDemoDrafts(nextAccountId?: number) {
    try {
        const store = storage();
        if (store) {
            const keys = Array.from({ length: store.length }, (_, index) => store.key(index));
            for (const key of keys) if (key?.startsWith(RESEARCH_DEMO_DRAFT_PREFIX)) store.removeItem(key);
        }
    } catch { /* Cleanup must never prevent logout. */ }
    try { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(RESEARCH_DEMO_DRAFT_CLEAR_EVENT, { detail: nextAccountId })); }
    catch { /* Notification failures cannot block session deletion. */ }
}
// Called only after a fresh server-authorized context, never from stored account claims.
export function activateResearchDemoDraftAccount(accountId: number) {
    try {
        const store = storage();
        if (!store) return false;
        const changed = store.getItem(ownerKey) !== String(accountId);
        if (changed) clearResearchDemoDrafts(accountId);
        store.setItem(ownerKey, String(accountId));
        return changed;
    } catch { return false; }
}
function canonicalQuestion(task: ResearchDemoTask, id: ResearchDemoQuestionId) {
    return id === "primary" ? RESEARCH_DEMO_QUESTIONS[task] : RESEARCH_DEMO_FOLLOWUPS[id === "explain" ? 0 : 1];
}
export function readResearchDemoDraft(context: ResearchDemoRecoveryContext, now = Date.now()) {
    let raw: string | null;
    try {
        const store = storage();
        if (!store) return undefined;
        raw = store.getItem(researchDemoDraftKey(context));
        if (store.getItem(ownerKey) !== String(context.accountId)) return null;
    } catch { return undefined; }
    try {
        if (!raw) return null;
        if (raw.length > 1024 || new TextEncoder().encode(raw).byteLength > 1024) throw Error("oversized");
        const draft = researchDemoDraftSchema.parse(JSON.parse(raw));
        if (researchDemoDraftKey(draft.context) !== researchDemoDraftKey(context) || !Number.isFinite(now) ||
            draft.updatedAt > now || now - draft.updatedAt >= RESEARCH_DEMO_DRAFT_TTL) throw Error("stale");
        return { task: draft.task, exchanges: draft.questions.map(id => {
            const question = canonicalQuestion(draft.task, id);
            return { question, answer: researchDemoAnswerSchema.parse(getResearchDemoAnswer(draft.task, question)) };
        }) };
    } catch { removeResearchDemoDraft(context); return null; }
}
export function saveResearchDemoDraft(context: ResearchDemoRecoveryContext, task: ResearchDemoTask, exchanges: SyntheticExchange[], now = Date.now()) {
    try {
        const store = storage();
        if (!store || store.getItem(ownerKey) !== String(context.accountId)) return false;
        if (!exchanges.length || exchanges.length > 4) { removeResearchDemoDraft(context); return false; }
        const questions = exchanges.map(exchange => {
            const id = (["primary", "explain", "verify"] as const).find(id => canonicalQuestion(task, id) === exchange.question);
            if (!id || JSON.stringify(getResearchDemoAnswer(task, exchange.question)) !== JSON.stringify(exchange.answer)) throw Error("noncanonical");
            return id;
        });
        const value = JSON.stringify(researchDemoDraftSchema.parse({ schemaVersion: 1, context, updatedAt: now, task, questions }));
        if (new TextEncoder().encode(value).byteLength > 1024) throw Error("oversized");
        store.setItem(researchDemoDraftKey(context), value);
        return true;
    } catch { removeResearchDemoDraft(context); return false; }
}
