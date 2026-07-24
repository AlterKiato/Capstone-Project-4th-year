"use server";

import { redirect } from "next/navigation";

import { registerUser } from "@/lib/services/auth.service";
import { createSession } from "@/lib/auth/session";

import { registerSchema } from "@/lib/validations/auth";
import { success } from "zod";

/**
 * Handles the registration form submission.
 *
 * Responsibilities:
 * 1. Read form values.
 * 2. Validate the input using Zod.
 * 3. Call the authentication service.
 * 4. Create the user's session.
 * 5. Redirect to the dashboard.
 */

export async function registerAction(formData: FormData){
    // validate all incoming fields
    const parsed = registerSchema.safeParse({
        firstName: formData.get("firstName"),
        lastName: formData.get("lastName"),
        email: formData.get("email"),
        password: formData.get("password"),
        confirmPassword: formData.get("confirmPassword"),
        roleID: Number(formData.get("roleId")),
    });

    //stop if validation failes
    if (!parsed.success){
        return{
            success: false,
            message:
                parsed.error.issues[0]?.message ??
                "invalid registration information",
        };
    }

    //register the new user
    const result = await registerUser(parsed.data);

    //registration failed
    if (!result.success || !result.data){
        return result;
    }

    //create an authenticated session
    await createSession({
        userId: result.data.id,
        email: result.data.email,
        roleId: result.data.roleID,
    });

}