// Database layer, can do CRUD only

import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function findUserByEmail(email: string) {
    return db.query.users.findFirst({
        where: eq(users.email, email),
    });
}

export async function findUserById(id: number) {
    return db.query.users.findFirst({
        where: eq(users.id, id),
    });
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