import "server-only";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { feedbacks, submissions, users } from "@/db/schema";
import { ROLE_IDS } from "@/lib/auth/roles";
import { SUBMISSION_STATUS } from "@/lib/constants/submission-status";
import { currentMainAdviserPredicate } from "./research-supervision.repository";
import type { ActivityRole, ActivityTotals, ActivityWindow } from "@/lib/reporting/period-activity";

export async function readPeriodActivity(actor: { id: number; role: ActivityRole }, window: ActivityWindow): Promise<ActivityTotals | null> {
    return db.transaction(async tx => {
        const scope = actor.role === "main" ? currentMainAdviserPredicate(actor.id) : sql`exists (select 1 from ${users}
            where ${users.id} = ${actor.id} and ${users.roleId} = ${ROLE_IDS.ADMIN} and ${users.isActive} = true)`;
        const [authorized] = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, actor.id), scope));
        if (!authorized) return null;
        // Limited Preview coverage assumes eligible writers store UTC-naive event times.
        const bounds = (column: typeof submissions.submittedAt | typeof feedbacks.createdAt) => and(
            sql`(${column} at time zone 'UTC') >= ${window.period.startInclusive}::timestamptz`,
            sql`(${column} at time zone 'UTC') < ${window.period.endExclusive}::timestamptz`,
            sql`(${column} at time zone 'UTC') >= ${window.reportingStartUtc}::timestamptz`);
        const [versions] = await tx.select({ count: count() }).from(submissions)
            .where(and(scope, bounds(submissions.submittedAt)));
        const decisions = await tx.select({ decision: feedbacks.decision, count: count() }).from(feedbacks)
            .where(and(scope, bounds(feedbacks.createdAt),
                inArray(feedbacks.decision, [SUBMISSION_STATUS.APPROVED, SUBMISSION_STATUS.REVISION_REQUIRED])))
            .groupBy(feedbacks.decision);
        return { submissions: versions.count,
            approved: decisions.find(row => row.decision === SUBMISSION_STATUS.APPROVED)?.count ?? 0,
            revisionRequired: decisions.find(row => row.decision === SUBMISSION_STATUS.REVISION_REQUIRED)?.count ?? 0 };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
