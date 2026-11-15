import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { PilotWindow } from "@/lib/validations/ai-pilot";

// One shared transaction lock; never hold a DB connection while awaiting the provider.
// No lease expiry: a crashed/frozen worker must not allow a second provider request.
export async function reservePilotAttempt(userId: number, window?: PilotWindow): Promise<string | null> {
    return db.transaction(async tx => {
        await tx.execute(sql`set local statement_timeout = '5000ms'`);
        const lock = await tx.execute(sql`select pg_try_advisory_xact_lock(84385, 1) as acquired`);
        if (lock[0]?.acquired !== true) return null;
        const id = randomUUID();
        const inserted = await tx.execute(sql`
            with instant as materialized (select clock_timestamp() as now),
            bounds as (select now, date_trunc('day', now at time zone 'UTC') at time zone 'UTC' as day_start from instant)
            insert into ai_pilot_attempts (id, user_id, attempted_at)
            select ${id}::uuid, ${userId}, bounds.now from bounds
            where not exists (select 1 from ai_pilot_attempts where released_at is null)
              and (select count(*) from ai_pilot_attempts where attempted_at >= bounds.day_start
                   and attempted_at < bounds.day_start + interval '24 hours') < 10
              and (select count(*) from ai_pilot_attempts where user_id = ${userId}
                   and attempted_at >= bounds.day_start and attempted_at < bounds.day_start + interval '24 hours') < 3
              and not exists (select 1 from ai_pilot_attempts where user_id = ${userId}
                   and attempted_at > bounds.now - interval '120 seconds')
              ${window ? sql`and bounds.now >= ${window.startsAt.toISOString()}::timestamptz
                and bounds.now < ${window.endsAt.toISOString()}::timestamptz
                and (select count(*) from ai_pilot_attempts where attempted_at >= ${window.startsAt.toISOString()}::timestamptz
                     and attempted_at < ${window.endsAt.toISOString()}::timestamptz) < 2
                and not exists (select 1 from ai_pilot_attempts where attempted_at >= ${window.startsAt.toISOString()}::timestamptz
                     and attempted_at < ${window.endsAt.toISOString()}::timestamptz
                     and attempted_at > bounds.now - interval '120 seconds')` : sql``}
            returning id`);
        return inserted[0]?.id === id ? id : null;
    }, { isolationLevel: "read committed" }); // Fresh snapshot after acquiring the shared lock; commit before provider.
}

export async function releasePilotAttempt(id: string): Promise<void> {
    // Token-bound/idempotent; counts/history are never refunded or deleted.
    await db.transaction(async tx => {
        await tx.execute(sql`set local statement_timeout = '5000ms'`);
        await tx.execute(sql`update ai_pilot_attempts set released_at = greatest(clock_timestamp(), attempted_at)
            where id = ${id}::uuid and released_at is null`);
    });
}

// Read-only status for the existing daily reservation policy. No new counters or persistence.
export async function getPilotDailyUsage(accountId: number) {
    if (!Number.isSafeInteger(accountId) || accountId <= 0) throw new Error("Quota unavailable");
    const rows = await db.execute(sql`
        with bounds as (select date_trunc('day', clock_timestamp() at time zone 'UTC') at time zone 'UTC' as day_start)
        select (select count(*)::int from ai_pilot_attempts, bounds
            where user_id = ${accountId} and attempted_at >= bounds.day_start
              and attempted_at < bounds.day_start + interval '24 hours') as account_attempts,
            (select count(*)::int from ai_pilot_attempts, bounds
            where attempted_at >= bounds.day_start
              and attempted_at < bounds.day_start + interval '24 hours') as global_attempts,
            exists(select 1 from ai_pilot_attempts where released_at is null) as busy,
            (select greatest(0, ceil(extract(epoch from
                (max(attempted_at) + interval '120 seconds' - clock_timestamp()))))::int
             from ai_pilot_attempts where user_id = ${accountId}) as wait_seconds`);
    const row = rows[0];
    if (!row || !Number.isInteger(row.account_attempts) || Number(row.account_attempts) < 0 ||
        !Number.isInteger(row.global_attempts) || Number(row.global_attempts) < 0 ||
        typeof row.busy !== "boolean" || !Number.isInteger(row.wait_seconds) || Number(row.wait_seconds) < 0)
        throw new Error("Quota unavailable");
    const accountRemaining = Math.max(0, 3 - Number(row.account_attempts)), globalRemaining = Math.max(0, 10 - Number(row.global_attempts));
    return { remaining: Math.min(accountRemaining, globalRemaining), accountRemaining, globalRemaining,
        busy: row.busy, waitSeconds: Number(row.wait_seconds) };
}
