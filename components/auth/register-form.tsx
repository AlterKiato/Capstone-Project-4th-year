"use client";

import { useActionState } from "react";

import { registerAction } from "@/lib/actions/auth.action";

import type { AuthUser, ServiceResult } from "@/types/auth";

/**
 * Initial state used before the registration form is submitted.
 */
const initialState: ServiceResult<AuthUser> = {
    success: false,
    message: "",
};

/**
 * Displays the registration form and submits registration data
 * through the registerAction Server Action.
 */
export default function RegisterForm() {
    const [state, formAction, isPending] = useActionState(
        registerAction,
        initialState
    );

    return (
        <form action={formAction}>
            <div>
                <label htmlFor="firstName">
                    First Name
                </label>

                <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                />
            </div>

            <div>
                <label htmlFor="lastName">
                    Last Name
                </label>

                <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                />
            </div>

            <div>
                <label htmlFor="email">
                    Email
                </label>

                <input
                    id="email"
                    name="email"
                    type="email"
                    required
                />
            </div>

            <div>
                <label htmlFor="password">
                    Password
                </label>

                <input
                    id="password"
                    name="password"
                    type="password"
                    required
                />
            </div>

            <div>
                <label htmlFor="confirmPassword">
                    Confirm Password
                </label>

                <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                />
            </div>

            {state.message && (
                <p>
                    {state.message}
                </p>
            )}

            <button
                type="submit"
                disabled={isPending}
            >
                {isPending ? "Creating account..." : "Register"}
            </button>
        </form>
    );
}