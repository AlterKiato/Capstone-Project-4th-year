import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityLogs, mainAdviserDesignation, users } from "@/db/schema";
import { ROLE_IDS } from "@/lib/auth/roles";
import type { MainAdviserConfiguration } from "@/types/research-supervision";

type SupervisionTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** SQL scope for institutional reads; historical group attribution grants no access. */
export function currentMainAdviserPredicate(userId: number) {
    return sql`exists (select 1 from ${mainAdviserDesignation} inner join ${users}
        on ${users.id} = ${mainAdviserDesignation.mainAdviserId}
        where ${mainAdviserDesignation.id} = 1 and ${users.id} = ${userId}
        and ${users.roleId} = ${ROLE_IDS.ADVISER} and ${users.isActive} = true)`;
}

/** Internal recipient lookup, also used by authenticated authority resolution. */
export async function findCurrentMainAdviserId() {
    const [row] = await db.select({ id: users.id }).from(mainAdviserDesignation)
        .innerJoin(users, eq(users.id, mainAdviserDesignation.mainAdviserId))
        .where(and(eq(mainAdviserDesignation.id, 1), eq(users.roleId, ROLE_IDS.ADVISER), eq(users.isActive, true)));
    return row?.id ?? null;
}

/** Accounts ascending -> singleton -> resource. Compatible with S3.1 replacement/revocation. */
export async function lockCurrentMainAdviser(tx: SupervisionTransaction, actorId: number, relatedUserIds: number[] = []) {
    const accounts = await tx.select({ id: users.id, roleId: users.roleId, isActive: users.isActive })
        .from(users).where(inArray(users.id, [...new Set([actorId, ...relatedUserIds])]))
        .orderBy(asc(users.id)).for("update");
    const actor = accounts.find(account => account.id === actorId);
    if (!actor?.isActive || actor.roleId !== ROLE_IDS.ADVISER) return null;
    const [designation] = await tx.select({ mainAdviserId: mainAdviserDesignation.mainAdviserId })
        .from(mainAdviserDesignation).where(eq(mainAdviserDesignation.id, 1)).for("share");
    return designation?.mainAdviserId === actorId ? accounts : null;
}

const choice = { id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email };

export async function readMainAdviserConfiguration(actorId: number): Promise<MainAdviserConfiguration | null> {
    return db.transaction(async tx => {
        const [actor] = await tx.select({ roleId: users.roleId, isActive: users.isActive })
            .from(users).where(eq(users.id, actorId)).for("share");
        if (!actor?.isActive || actor.roleId !== ROLE_IDS.ADMIN) return null;
        const [designation] = await tx.select().from(mainAdviserDesignation).where(eq(mainAdviserDesignation.id, 1));
        if (!designation) throw new Error("Main Adviser configuration unavailable.");
        const [current] = designation.mainAdviserId === null ? [] : await tx.select({ ...choice, roleId: users.roleId, isActive: users.isActive })
            .from(users).where(eq(users.id, designation.mainAdviserId));
        const eligibleAdvisers = await tx.select(choice).from(users)
            .where(and(eq(users.roleId, ROLE_IDS.ADVISER), eq(users.isActive, true)))
            .orderBy(asc(users.lastName), asc(users.firstName), asc(users.id));
        return {
            revision: designation.revision,
            current: current ? { id: current.id, firstName: current.firstName, lastName: current.lastName, email: current.email,
                eligible: current.isActive && current.roleId === ROLE_IDS.ADVISER } : null,
            eligibleAdvisers,
        };
    });
}

export async function replaceMainAdviserDesignation(actorId: number, mainAdviserId: number, expectedRevision: number) {
    return db.transaction(async tx => {
        // Same order as updateManagedUserForAdmin: accounts ascending, then singleton.
        // Locking the target keeps its eligibility stable through the designation commit.
        const accounts = await tx.select({ id: users.id, roleId: users.roleId, isActive: users.isActive })
            .from(users).where(inArray(users.id, [actorId, mainAdviserId])).orderBy(asc(users.id)).for("update");
        const actor = accounts.find(account => account.id === actorId);
        if (!actor?.isActive || actor.roleId !== ROLE_IDS.ADMIN) return { kind: "denied" } as const;
        const target = accounts.find(account => account.id === mainAdviserId);
        if (!target?.isActive || target.roleId !== ROLE_IDS.ADVISER) return { kind: "ineligible" } as const;
        const [designation] = await tx.select().from(mainAdviserDesignation).where(eq(mainAdviserDesignation.id, 1)).for("update");
        if (!designation) throw new Error("Main Adviser configuration unavailable.");
        if (designation.revision !== expectedRevision) return { kind: "stale" } as const;
        if (designation.mainAdviserId === mainAdviserId) return { kind: "unchanged" } as const;
        const [saved] = await tx.update(mainAdviserDesignation).set({ mainAdviserId, updatedBy: actorId,
            revision: sql`${mainAdviserDesignation.revision} + 1`, updatedAt: new Date() })
            .where(and(eq(mainAdviserDesignation.id, 1), eq(mainAdviserDesignation.revision, expectedRevision)))
            .returning({ revision: mainAdviserDesignation.revision });
        if (!saved) throw new Error("Main Adviser designation could not be confirmed.");
        await tx.insert(activityLogs).values({ userId: actorId, action: "Main Adviser Designated",
            description: `Main Adviser changed from user ${designation.mainAdviserId ?? "unconfigured"} to user ${mainAdviserId}; designation revision ${designation.revision} -> ${saved.revision}.` });
        return { kind: "updated" } as const;
    });
}
