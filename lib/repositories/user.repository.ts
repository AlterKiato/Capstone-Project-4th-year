// Database layer, can do CRUD only

import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function findUserByEmail(email: string){
    return await db.query.users.findFirst({
        where: eq(users.email, email),
    });
}

export async function findUserById(id: number) {
    return await db.query.users.findFirst({
        where: eq(users.id, id),
    });
}

export async function createUser( data: typeof users.$inferInsert){
    const [user] = await db
        .insert(users)
        .values(data)
        .returning();

    return user; 
}