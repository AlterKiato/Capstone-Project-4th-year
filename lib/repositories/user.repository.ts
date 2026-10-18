// Database layer, can do CRUD only

import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq, desc, inArray, asc } from "drizzle-orm";

export async function findUserByEmail(email: string) {
    return db.query.users.findFirst({
        where: eq(users.email, email),
    });
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function findUserById(id: number, executor: typeof db | DbTransaction = db) {
    return executor.query.users.findFirst({
        where: eq(users.id, id),
    });
}

/** Match Admin mutation ordering: serialize current-account checks with revocation. */
export async function findUserByIdForUpdate(id: number, tx: DbTransaction) {
    const [account] = await tx.select({ roleId: users.roleId, isActive: users.isActive })
        .from(users).where(eq(users.id, id)).for("update");
    return account;
}

export async function findAllUsers() {
    return db
        .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            roleId: users.roleId,
            profileImage: users.profileImage,
            isActive: users.isActive,
            lastLogin: users.lastLogin,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt));
}

export async function createUser(
    data: typeof users.$inferInsert
) {
    const [user] = await db
        .insert(users)
        .values(data)
        .returning();

    return user;
}

/**
 * Updates the active status of a user.
 */
export async function updateUserStatus(
    userId: number,
    isActive: boolean
) {
    const [updatedUser] = await db
        .update(users)
        .set({
            isActive,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            roleId: users.roleId,
            isActive: users.isActive,
        });

    return updatedUser;
}

/**
 * Updates the role assigned to a user.
 */
export async function updateUserRole(
    userId: number,
    roleId: number
) {
    const [updatedUser] = await db
        .update(users)
        .set({
            roleId,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            roleId: users.roleId,
            isActive: users.isActive,
        });

    return updatedUser;
}

/**
 * Finds all users assigned to a specific role.
 */
export async function findUsersByRoleId(
    roleId: number
) {
    return await db
        .select()
        .from(users)
        .where(
            eq(
                users.roleId,
                roleId
            )
        );
}
// Privileged creation locks and rechecks the acting Admin in the same transaction.
export async function createManagedUserForAdmin(data: typeof users.$inferInsert, actorId: number) {
    return db.transaction(async tx => {
        const [actor] = await tx.select({roleId: users.roleId, isActive: users.isActive}).from(users).where(eq(users.id, actorId)).for("update");
        if (!actor?.isActive || actor.roleId !== 1) return null;
        const [created] = await tx.insert(users).values(data).returning({ id: users.id });
        return created;
    });
}

// Lock both accounts in ID order so actor deactivation or role changes cannot
// pass authorization and then race a privileged write.
export async function updateManagedUserForAdmin(actorId: number, userId: number, change: { roleId: number } | { isActive: boolean }) {
    return db.transaction(async tx => {
        const accounts = await tx.select({ id: users.id, roleId: users.roleId, isActive: users.isActive })
            .from(users).where(inArray(users.id, [actorId, userId])).orderBy(asc(users.id)).for("update");
        const actor = accounts.find(account => account.id === actorId);
        if (!actor?.isActive || actor.roleId !== 1 || actorId === userId) return { kind: "denied" } as const;
        if (!accounts.some(account => account.id === userId)) return { kind: "missing" } as const;
        const [updated] = await tx.update(users).set({ ...change, updatedAt: new Date() }).where(eq(users.id, userId))
            .returning({ id: users.id, firstName: users.firstName, lastName: users.lastName });
        return updated ? { kind: "updated", user: updated } as const : { kind: "missing" } as const;
    });
}
