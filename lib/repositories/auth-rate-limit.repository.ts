import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { authRateLimitBuckets as buckets } from "@/db/schema";
import { AUTH_LIMIT_WINDOW_SECONDS } from "@/lib/auth/auth-rate-limit-config";

export type AuthLimitBucket = { keyDigest: string; limit: number };

/** The global counter is always first: denied traffic cannot allocate arbitrary identity rows. */
export async function consumeAuthBuckets(global: AuthLimitBucket, identities: AuthLimitBucket[]): Promise<boolean> {
    return db.transaction(async tx => {
        // Bounded lazy retention, skip concurrent cleaners instead of waiting on their rows.
        await tx.execute(sql`delete from ${buckets} where (key_digest, window_start) in (
            select key_digest, window_start from ${buckets} where expires_at <= clock_timestamp()
            order by expires_at limit 64 for update skip locked
        )`);
        const [clock] = await tx.execute<{ now: string | Date }>(sql`select clock_timestamp() as "now"`);
        const now = new Date(clock.now).getTime();
        if (!Number.isFinite(now)) throw new Error("Authentication limiting unavailable.");
        const windowMs = AUTH_LIMIT_WINDOW_SECONDS * 1000;
        const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
        const expiresAt = new Date(windowStart.getTime() + windowMs + 3600000);
        // All callers lock global first, then identity digests in a stable order.
        for (const bucket of [global, ...[...identities].sort((a, b) => a.keyDigest < b.keyDigest ? -1 : a.keyDigest > b.keyDigest ? 1 : 0)]) {
            const [admitted] = await tx.execute(sql`insert into ${buckets} (key_digest, window_start, expires_at, hit_count)
                values (${bucket.keyDigest}, ${sql.param(windowStart, buckets.windowStart)}, ${sql.param(expiresAt, buckets.expiresAt)}, 1)
                on conflict (key_digest, window_start) do update set hit_count = ${buckets.hitCount} + 1
                where ${buckets.hitCount} < ${bucket.limit} returning hit_count`);
            // Commit preceding counts even when this bucket denies the attempt. No bcrypt/delivery follows.
            if (!admitted) return false;
        }
        return true;
    });
}
