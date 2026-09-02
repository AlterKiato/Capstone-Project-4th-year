"use client";

import { useActionState } from "react";

import { loginAction } from "@/lib/actions/auth.action";

import type { AuthUser, ServiceResult } from "@/types/auth";

/**
 * Initial state used before the login form is submitted.
 */
const initialState: ServiceResult<AuthUser> = {
    success: false,
    message: "",
};

/**
 * Displays the login form and handles login form submission.
 */
export default function LoginForm() {
    const [state, formAction, isPending] = useActionState(
        loginAction,
        initialState
    );

    return (
        <form action={formAction}>
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

            {state.message && (
                <p>{state.message}</p>
            )}

            <button
                type="submit"
                disabled={isPending}
            >
                {isPending ? "Logging in..." : "Login"}
            </button>
        </form>
    );
}