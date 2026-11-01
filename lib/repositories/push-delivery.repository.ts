import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import type { PushBudget, PushDeliveryRepository } from "@/lib/push/delivery";

type Database = PostgresJsDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
const subscriptions = schema.pushSubscriptions;
export function createPushDeliveryRepository(database: Database): PushDeliveryRepository {
    async function bounded<T>(budget: PushBudget, operation: (tx: Transaction) => Promise<T>): Promise<T> {
        budget.check();
        // The guarded adapter does NOT expose query.cancel(). Await every transaction; never
        // abandon a promise or close the shared pool. Pool/identity/commit waits can exceed 3s.
        return database.transaction(async tx => {
            budget.check();
            await tx.execute(sql`set local lock_timeout = '250ms'`);
            budget.check();
            await tx.execute(sql`set local statement_timeout = '750ms'`);
            budget.check();
            const result = await operation(tx);
            budget.check();
            return result;
        });
    }
    return {
        find: (userId, roleId, keyId, budget) => bounded(budget, async tx => {
            const [row] = await tx.select({ generation: subscriptions.id, userId: subscriptions.userId, roleId: schema.users.roleId,
                endpoint: subscriptions.endpoint, p256dh: subscriptions.p256dh, auth: subscriptions.auth, vapidKeyId: subscriptions.vapidKeyId,
                authorizedUntil: subscriptions.authorizedUntil, browserExpiresAt: subscriptions.browserExpiresAt })
                .from(subscriptions).innerJoin(schema.users, eq(subscriptions.userId, schema.users.id))
                .where(and(eq(subscriptions.userId, userId), eq(schema.users.roleId, roleId), eq(schema.users.isActive, true),
                    eq(subscriptions.enabled, true), eq(subscriptions.vapidKeyId, keyId), gt(subscriptions.authorizedUntil, sql`clock_timestamp()`),
                    or(isNull(subscriptions.browserExpiresAt), gt(subscriptions.browserExpiresAt, sql`clock_timestamp()`)))).limit(1);
            if (!row?.endpoint || !row.p256dh || !row.auth || !row.vapidKeyId || !row.authorizedUntil) return null;
            return { ...row, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth, vapidKeyId: row.vapidKeyId, authorizedUntil: row.authorizedUntil };
        }),
        disable: (captured, budget) => bounded(budget, async tx => {
            const rows = await tx.update(subscriptions).set({ id: randomUUID(), enabled: false, endpoint: null, p256dh: null, auth: null,
                vapidKeyId: null, authorizedUntil: null, browserExpiresAt: null, updatedAt: sql`clock_timestamp()` })
                .where(and(eq(subscriptions.userId, captured.userId), eq(subscriptions.id, captured.generation),
                    eq(subscriptions.endpoint, captured.endpoint), eq(subscriptions.enabled, true))).returning({ id: subscriptions.id });
            return rows.length === 1;
        }),
    };
}
