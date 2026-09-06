"use server";

import { redirect } from "next/navigation";

import { createSession, deleteSession,} from "@/lib/auth/session";

import { registerUser, loginUser,} from "@/lib/services/auth.service";

import { registerSchema, loginSchema,} from "@/lib/validations/auth";

import type { AuthUser, ServiceResult,} from "@/types/auth";

/**
 * Handles registration form submissions.
 *
 * Responsibilities:
 * - Receive the previous form state and submitted form data.
 * - Validate the registration data using Zod.
 * - Register the user through the service layer.
 * - Create a session after successful registration.
 * - Redirect to the dashboard on success.
 *
 * The user's role is intentionally not received from
 * the client. The service layer securely assigns the
 * Student role for public registration.
 */
export async function registerAction(
    previousState: ServiceResult<AuthUser>,
    formData: FormData
): Promise<ServiceResult<AuthUser>> {
    // Prevent TypeScript from reporting the parameter as unused.
    void previousState;

    // Validate the submitted registration data.
    // Role assignment is intentionally excluded.
    const parsed = registerSchema.safeParse({
        firstName: formData.get("firstName"),
        lastName: formData.get("lastName"),
        email: formData.get("email"),
        password: formData.get("password"),
        confirmPassword: formData.get("confirmPassword"),
    });

    // Return a validation error to the client form.
    if (!parsed.success) {
        return {
            success: false,
            message:
                parsed.error.issues[0]?.message ??
                "Invalid registration information.",
        };
    }

    // Register the user through the authentication service.
    // The service determines the correct role for public users.
    const result = await registerUser(parsed.data);

    // Return the error state if registration fails.
    if (!result.success || !result.data) {
        return result;
    }

    // Create an authenticated session for the newly registered user.
    await createSession({
        userId: result.data.id,
        email: result.data.email,
        roleId: result.data.roleId,
    });

    // Redirect after successful registration.
    redirect("/dashboard");
}

/**
 * Handles login form submissions.
 *
 * Responsibilities:
 * - Receive the previous form state and submitted form data.
 * - Validate login credentials using Zod.
 * - Authenticate the user through the service layer.
 * - Create a session after successful authentication.
 * - Return errors to the form or redirect on success.
 */
export async function loginAction(
    previousState: ServiceResult<AuthUser>,
    formData: FormData
): Promise<ServiceResult<AuthUser>> {
    // Prevent TypeScript from reporting the parameter as unused.
    void previousState;

    // Validate the submitted login data.
    const parsed = loginSchema.safeParse({
        email: formData.get("email"),
        password: formData.get("password"),
    });

    // Return a validation error to the client form.
    if (!parsed.success) {
        return {
            success: false,
            message:
                parsed.error.issues[0]?.message ??
                "Invalid login information.",
        };
    }

    // Authenticate the user through the authentication service.
    const result = await loginUser(parsed.data);

    // Return the error state if authentication fails.
    if (!result.success || !result.data) {
        return result;
    }

    // Create an authenticated session.
    await createSession({
        userId: result.data.id,
        email: result.data.email,
        roleId: result.data.roleId,
    });

    // Redirect after successful login.
    redirect("/dashboard");
}

/**
 * Logs the current user out.
 *
 * Deletes the authentication session.
 * The client then redirects the user to the login page.
 */
export async function logoutAction() {
    await deleteSession();
}