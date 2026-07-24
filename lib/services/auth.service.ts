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

    const hashedPassword = await hashPassword(data.password);
    const user = await createUser({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: hashedPassword,
        roleId: data.roleId,
    });

    const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        roleID: user.roleId,
        firstName: user.firstName,
        lastName: user.lastName,
    };

    await createSession({
        userId: user.id,
        email: user.email,
        roleId: user.roleId,
    });

    return {
        success: true,
        message: "User registered successfully",
        data: authUser,
    };
}


export async function loginUser(data: LoginInput): Promise<ServiceResult<AuthUser>>{
    const user = await findUserByEmail(data.email);

    if (!user) {
        return {
            success: false,
            message: "Invalid email or password",
        };
    }

    const isValidPassword = await comparePassword(data.password, user.password);

    if (!isValidPassword) {
        return {
            success: false,
            message: "Invalid email or password",
        };
    }

    const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        roleID: user.roleId,
        firstName: user.firstName,
        lastName: user.lastName,
    };

    await createSession({
        userId: user.id,
        email: user.email,
        roleId: user.roleId,
    });

    return {
        success: true,
        message: "Logged in successfully",
        data: authUser,
    };
}

