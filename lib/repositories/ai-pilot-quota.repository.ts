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
