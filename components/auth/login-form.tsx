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
        <form action={formAction} className="dashboard-form auth-form" aria-busy={isPending} aria-describedby="login-message">
            <p className="form-help">All fields are required.</p>
            <div>
                <label htmlFor="email">
                    Email
                </label>

                <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
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
                    autoComplete="current-password"
                    minLength={8}
                    maxLength={100}
                    required
                />
            </div>

            <p id="login-message" className={state.message ? "form-message" : undefined} aria-live="polite" aria-atomic="true">{state.message}</p>

            <button
                type="submit"
                disabled={isPending}
            >
                {isPending ? "Logging in..." : "Login"}
            </button>
        </form>
    );
}
