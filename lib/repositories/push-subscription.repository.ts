import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { ROLE_IDS } from "@/lib/auth/roles";
import { PushFailure, type Enrollment, type PushActor, type PushRepository } from "@/lib/push/contract";

type Database = PostgresJsDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Row = typeof schema.pushSubscriptions.$inferSelect;
const subscriptions = schema.pushSubscriptions;
function metadata(row: Row): Enrollment {
    return { generation: row.id, enabled: row.enabled, authorizedUntil: row.authorizedUntil?.toISOString() ?? null,
        vapidKeyId: row.vapidKeyId, endpointFingerprint: row.endpoint ? createHash("sha256").update(row.endpoint).digest("hex") : null };
}
function uniqueConflict(error: unknown): boolean {
    for (let depth = 0; depth < 5 && error && typeof error === "object"; depth++) {
        const item = error as { code?: unknown; cause?: unknown };
        if (item.code === "23505") return true;
        error = item.cause;
    }
    return false;
}

export function createPushSubscriptionRepository(database: Database): PushRepository {
    async function locked<T>(actor: PushActor, operation: (tx: Transaction, row: Row | undefined, now: Date) => Promise<T>): Promise<T> {
        try {
            return await database.transaction(async tx => {
                await tx.execute(sql`set local lock_timeout = '3s'`);
                await tx.execute(sql`set local statement_timeout = '5s'`);
                // The user row exists before the first enrollment and serializes every mutation.
                const [account] = await tx.select({ roleId: schema.users.roleId, isActive: schema.users.isActive })
                    .from(schema.users).where(eq(schema.users.id, actor.userId)).for("update");
                if (!account?.isActive || account.roleId !== actor.roleId) throw new PushFailure("unauthenticated");
                if (actor.roleId !== ROLE_IDS.ADVISER && actor.roleId !== ROLE_IDS.STUDENT) throw new PushFailure("forbidden");
                const [clock] = await tx.execute<{ now: Date | string }>(sql`select clock_timestamp() as now`);
                const now = new Date(clock.now);
                if (!Number.isFinite(now.getTime())) throw new PushFailure("unavailable");
                if (actor.expiresAt <= now) throw new PushFailure("unauthenticated");
                const [row] = await tx.select().from(subscriptions).where(eq(subscriptions.userId, actor.userId)).for("update");
                return operation(tx, row, now);
            });
        } catch (error) {
            if (error instanceof PushFailure) throw error;
            // Unique endpoint/UUID collisions are indistinguishable; never disclose the other owner.
            throw new PushFailure(uniqueConflict(error) ? "conflict" : "unavailable");
        }
    }
    return {
        read: actor => locked(actor, async (_tx, row) => row ? metadata(row) : null),
        register: (actor, input, keyId) => locked(actor, async (tx, row, now) => {
            const subscription = input.subscription;
            const browserExpiresAt = subscription.expirationTime === null ? null : new Date(subscription.expirationTime);
            const authorizedUntil = new Date(Math.min(actor.expiresAt.getTime(), browserExpiresAt?.getTime() ?? Infinity));
            if (authorizedUntil <= now) throw new PushFailure("invalid");
            if (row?.id === input.registrationId) {
                if (row.enabled && row.authorizedUntil! > now && row.endpoint === subscription.endpoint &&
                    row.p256dh === subscription.keys.p256dh && row.auth === subscription.keys.auth && row.vapidKeyId === keyId &&
                    (row.browserExpiresAt?.getTime() ?? null) === subscription.expirationTime) return metadata(row);
                throw new PushFailure("conflict");
            }
            if ((row?.id ?? null) !== input.expectedGeneration) throw new PushFailure("conflict");
            const values = { id: input.registrationId, userId: actor.userId, enabled: true, endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, vapidKeyId: keyId, authorizedUntil,
                browserExpiresAt, createdAt: row?.createdAt ?? now, updatedAt: now };
            const [saved] = row ? await tx.update(subscriptions).set(values)
                .where(and(eq(subscriptions.userId, actor.userId), eq(subscriptions.id, row.id))).returning() :
                await tx.insert(subscriptions).values(values).returning();
            if (!saved) throw new PushFailure("conflict");
            return metadata(saved);
        }),
        disable: (actor, input) => locked(actor, async (tx, row, now) => {
            if (row && (!row.enabled || !input.generations.includes(row.id))) return metadata(row);
            const values = { id: randomUUID(), userId: actor.userId, enabled: false, endpoint: null,
                p256dh: null, auth: null, vapidKeyId: null, authorizedUntil: null, browserExpiresAt: null,
                createdAt: row?.createdAt ?? now, updatedAt: now };
            // Insert a barrier even before the first POST completes; late expected=null requests fail.
            const [saved] = row ? await tx.update(subscriptions).set(values)
                .where(and(eq(subscriptions.userId, actor.userId), eq(subscriptions.id, row.id))).returning() :
                await tx.insert(subscriptions).values(values).returning();
            if (!saved) throw new PushFailure("conflict");
            return metadata(saved);
        }),
    };
}
