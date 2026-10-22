// Business logic used by authentication actions and APIs.

import {hashPassword,comparePassword,} from "@/lib/auth/hash";

import {createUser,findUserByEmail,} from "../repositories/user.repository";

import type {ServiceResult,AuthUser,} from "@/types/auth";

import type {RegisterInput,LoginInput,} from "@/lib/validations/auth";

import { ROLE_IDS } from "@/lib/auth/roles";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import { allowAuthAttempt } from "@/lib/services/auth-rate-limit.service";
import { AUTH_RETRY_MESSAGE } from "@/lib/auth/auth-rate-limit-config";

// Public, non-account hash used only to pad missing-account password checks (bcrypt cost 12).
const DUMMY_PASSWORD_HASH = "$2b$12$f4v6OlKeWPks5KCsTAl7fO25iz/trq.W5J0mj6LKi.ydF0Kq1orOa";
const registrationFailure = "Unable to create the account. Check the supplied details or sign in.";

/**
 * Registers a new user.
 *
 * Responsibilities:
 * - Normalize the submitted email.
 * - Check whether the email already exists.
 * - Hash the user's password.
 * - Assign the Student role securely.
 * - Save the user to the database.
 * - Return safe user information.
 *
 * Session creation is handled by auth.action.ts.
 */
export async function registerUser(
    data: RegisterInput
): Promise<ServiceResult<AuthUser>> {
    try {
        const parsed = registerSchema.safeParse(data);
        if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid registration information." };
        data = parsed.data;
        const email = data.email.trim().toLowerCase();
        if (!await allowAuthAttempt("registration", email)) return { success: false, message: AUTH_RETRY_MESSAGE };

        // Check whether the email is already registered.
        const existingUser = await findUserByEmail(email);

        if (existingUser) {
            return {
                success: false,
                message: registrationFailure,
            };
        }

        // Hash the password before storing it in the database.
        const hashedPassword = await hashPassword(data.password);

        // Public registration always creates a Student account.
        const newUser = {
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            email,
            password: hashedPassword,
            roleId: ROLE_IDS.STUDENT,
        };

        // Save the new user to the database.
        const user = await createUser(newUser);

        // Return only safe user information.
        return {
            success: true,
            message: "Registration successful.",
            data: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                roleId: user.roleId,
            },
        };
    } catch {
        return {
            success: false,
            message: registrationFailure,
        };
    }
}

/**
 * Authenticates an existing user.
 *
 * Responsibilities:
 * - Normalize the submitted email.
 * - Find the user by email.
 * - Check whether the account is active.
 * - Compare the supplied password with the stored hash.
 * - Return safe authenticated user information.
 *
 * Session creation is handled by auth.action.ts.
 */
export async function loginUser(
    data: LoginInput
): Promise<ServiceResult<AuthUser>> {
    try {
        const parsed = loginSchema.safeParse(data);
        if (!parsed.success) return { success: false, message: "Invalid email or password." };
        data = parsed.data;
        const email = data.email.trim().toLowerCase();
        if (!await allowAuthAttempt("login", email)) return { success: false, message: AUTH_RETRY_MESSAGE };

        // Find the account using the normalized email.
        const user = await findUserByEmail(email);

        // Use a generic response so the existence of an account
        // cannot be discovered through invalid login attempts.
        // Missing and inactive accounts still perform one bcrypt comparison. No artificial sleeps.
        const passwordMatch = await comparePassword(
            data.password,
            user?.password ?? DUMMY_PASSWORD_HASH
        );

        if (!user || !passwordMatch || !user.isActive) {
            return {
                success: false,
                message: "Invalid email or password.",
            };
        }

        // Return only safe authenticated user information.
        return {
            success: true,
            message: "Login successful.",
            data: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                roleId: user.roleId,
            },
        };
    } catch {
        return {
            success: false,
            message: "Unable to process login. Please try again.",
        };
    }
}
