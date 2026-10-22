import "server-only";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, emailVerificationRequests } from "@/db/schema";
import { ROLE_IDS } from "@/lib/auth/roles";

export type VerificationRequest = typeof emailVerificationRequests.$inferSelect;
type VerificationAccount = Pick<typeof users.$inferSelect, "id" | "email" | "roleId" | "isActive" | "emailVerifiedAt">;

export interface VerificationStore {
    account: VerificationAccount | undefined;
    now: Date;
    readRequest(): Promise<VerificationRequest | undefined>;
    saveRequest(request: VerificationRequest): Promise<void>;
    consume(digest: string, email: string): Promise<void>;
}

export async function readVerificationAccount(userId: number) {
    const [account] = await db.select({ email: users.email, roleId: users.roleId, isActive: users.isActive,
        emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, userId));
    return account;
}

export async function findVerificationUserId(digest: string): Promise<number | undefined> {
    const [row] = await db.select({ userId: emailVerificationRequests.userId })
        .from(emailVerificationRequests).where(eq(emailVerificationRequests.tokenDigest, digest));
    return row?.userId;
}

/** All verification writers lock the user first, matching Admin account mutation locks. */
export async function withVerificationAccount<T>(userId: number, work: (store: VerificationStore) => Promise<T>): Promise<T> {
    return db.transaction(async tx => {
        const [account] = await tx.select({ id: users.id, email: users.email, roleId: users.roleId,
            isActive: users.isActive, emailVerifiedAt: users.emailVerifiedAt })
            .from(users).where(eq(users.id, userId)).for("update");
        // Obtain time AFTER the lock wait; transaction-start time can already be stale.
        const [clock] = await tx.execute<{ now: string | Date }>(sql`select clock_timestamp() as "now"`);
        const now = new Date(clock.now);
        return work({
            account, now,
            readRequest: async () => {
                const [request] = await tx.select().from(emailVerificationRequests)
                    .where(eq(emailVerificationRequests.userId, userId));
                return request;
            },
            saveRequest: async request => {
                await tx.insert(emailVerificationRequests).values(request)
                    .onConflictDoUpdate({ target: emailVerificationRequests.userId, set: request });
            },
            consume: async (digest, email) => {
                const [consumed] = await tx.update(emailVerificationRequests).set({ consumedAt: now }).where(and(
                    eq(emailVerificationRequests.userId, userId), eq(emailVerificationRequests.tokenDigest, digest),
                    eq(emailVerificationRequests.requestedEmail, email), isNull(emailVerificationRequests.consumedAt),
                    gt(emailVerificationRequests.expiresAt, now),
                )).returning({ userId: emailVerificationRequests.userId });
                if (!consumed) throw new Error("Verification could not be completed.");
                const [verified] = await tx.update(users).set({ emailVerifiedAt: now }).where(and(
                    eq(users.id, userId), eq(users.email, email), eq(users.isActive, true), eq(users.roleId, ROLE_IDS.STUDENT),
                    isNull(users.emailVerifiedAt),
                )).returning({ id: users.id });
                // Throwing rolls back BOTH updates, including the consumed marker.
                if (!verified) throw new Error("Verification could not be completed.");
            },
        });
    });
}
