import "server-only";
import { db } from "@/lib/db";
import { users, aiEligibilityEvents, aiConsentEvents } from "@/db/schema";
import { eq, desc, inArray, asc } from "drizzle-orm";

export async function findLatestAIEligibility(userId: number) {
    const [event] = await db.select().from(aiEligibilityEvents).where(eq(aiEligibilityEvents.userId, userId)).orderBy(desc(aiEligibilityEvents.id)).limit(1);
    return event ?? null;
}
export async function findLatestAIConsent(userId: number) {
    const [event] = await db.select().from(aiConsentEvents).where(eq(aiConsentEvents.userId, userId)).orderBy(desc(aiConsentEvents.id)).limit(1);
    return event ?? null;
}

// All governance writers serialize on users rows, in ID order. No update/delete/bootstrap API.
export async function withAIAccountLocks<T>(ids: number[], work: (store: AIGovernanceStore) => Promise<T>): Promise<T> {
    return db.transaction(async tx => {
        const accounts = await tx.select({ id: users.id, roleId: users.roleId, isActive: users.isActive, updatedAt: users.updatedAt })
            .from(users).where(inArray(users.id, [...new Set(ids)].sort((a,b) => a-b))).orderBy(asc(users.id)).for("update");
        return work({
            accounts,
            latestEligibility: async userId => {
                const [event] = await tx.select().from(aiEligibilityEvents).where(eq(aiEligibilityEvents.userId, userId)).orderBy(desc(aiEligibilityEvents.id)).limit(1);
                return event ?? null;
            },
            latestConsent: async userId => {
                const [event] = await tx.select().from(aiConsentEvents).where(eq(aiConsentEvents.userId, userId)).orderBy(desc(aiConsentEvents.id)).limit(1);
                return event ?? null;
            },
            appendEligibility: async data => { const [event] = await tx.insert(aiEligibilityEvents).values(data).returning(); return event; },
            appendConsent: async data => { const [event] = await tx.insert(aiConsentEvents).values(data).returning(); return event; },
        });
    });
}
export type AIAccount = Pick<typeof users.$inferSelect, "id" | "roleId" | "isActive" | "updatedAt">;
export type EligibilityEvent = typeof aiEligibilityEvents.$inferSelect;
export type ConsentEvent = typeof aiConsentEvents.$inferSelect;
export interface AIGovernanceStore {
    accounts: AIAccount[];
    latestEligibility: (id: number) => Promise<EligibilityEvent | null>;
    latestConsent: (id: number) => Promise<ConsentEvent | null>;
    appendEligibility: (data: typeof aiEligibilityEvents.$inferInsert) => Promise<EligibilityEvent>;
    appendConsent: (data: typeof aiConsentEvents.$inferInsert) => Promise<ConsentEvent>;
}
