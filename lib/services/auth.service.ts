// Where business logic resides that can be used in REST API

import { hashPassword, comparePassword } from "@/lib/auth/hash"
import { createUser, findUserByEmail } from "../repositories/user.repository"

import type { ServiceResult, AuthUser } from "@/types/auth"
import type { RegisterInput, LoginInput } from "@/lib/validations/auth"

/**
 * Registers a new user.
 *
 * Responsibilities:
 * - Check if the email is already registered.
 * - Hash the user's password.
 * - Save the user to the database.
 * - Return safe user information.
 *
 * Note:
 * Session creation is handled by auth.action.ts,
 * not inside this service.
 */

export async function registerUser(data: RegisterInput): Promise<ServiceResult<AuthUser>> {
   
    const existingUser = await findUserByEmail(data.email);

    if (existingUser){
        return {
            success: false,
            message: "Email already exists",
        }
    }
    

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

/**
 * Authenticates an existing user.
 *
 * Responsibilities:
 * - Find the user by email.
 * - Compare the supplied password with the stored hash.
 * - Return authenticated user information.
 *
 * Note:
 * Session creation is handled by auth.action.ts.
 */

export async function loginUser( data: LoginInput ): Promise<ServiceResult<AuthUser>>{
    // find user using the submitted email
    const user = await findUserByEmail(data.email);
    // do not reveal whether the email exist for security reasons, just return a generic message
    if (!user) {
        return {
            success: false,
            message: "Invalid email or password",
        };
    }
    // check if the account is active or not 
    if (!user.isActive){
        return {
            success: false,
            message: "User account is inactive. Please contact support.",
        };
    }
    
    // compare the submitted passwrd with the stored bcrypt hash
    const passwordMatch = await comparePassword(data.password, user.password);

    // Reject the login if the passwrd doesn't match HAHAHHAH wala lng natawa lang
    if (!passwordMatch) {
        return {
            success: false,
            message: "Invalid email or password",
        };
    }

    // Return safe user information after ang saksespul na authentication
    return {
        success: true,
        message: "Login successful.",
        data: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            roleID: user.roleId,
        },
    };
}



