import { db } from "@/lib/db"
import { users } from "@/db/schema/users"
import { role } from "@/db/schema/role"
import { eq } from "drizzle-orm"
import { hashPassword, comparePassword } from "@/lib/auth/hash"
import { createSession } from "@/lib/auth/session"

import type { ServiceResult, AuthUser } from "@/types/auth"
import type { RegisterInput, LoginInput } from "@/lib/validations/auth"
import { createUser, findUserByEmail } from "../repositories/user.repository"

export async function registerUser(data: RegisterInput): Promise<ServiceResult<AuthUser>> {
    const existingUser = await findUserByEmail(data.email);

    if (existingUser){
        return {
            success: false,
            message: "Email already exists",
        }
    }
        return {
        success: false,
        message: "Not implemented yet.",
    };

    // hashing password (plain text to random shii)
    const hashedPassword = await hashPassword(data.password);

    // prep the user object before sending it to database
    const newUser = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: hashedPassword,
        roleId: data.roleId,
    };
    // save the user to the database
    const user = await createUser(newUser);

   // TODO (Sprint 1.7B):
    // Automatically log the user in after registration.
    //
    // await createSession({
    //     userId: user.id,
    //     email: user.email,
    //     roleId: user.roleId,
    // });

    // Return only safe user information.

    return {
        success: true, 
        message: "Reggistration successful.",
        data: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            roleID: user.roleId
        },
    };

    
}


export async function loginUser( data: LoginInput ): Promise<ServiceResult>{
    throw new Error("this is empty for now")
}

