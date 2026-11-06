"use client";

import { useActionState, useState } from "react";

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
    const [showPassword, setShowPassword] = useState(false);
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

                <div className="auth-password-field">
                    <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        minLength={8}
                        maxLength={100}
                        required
                    />
                    <button
                        type="button"
                        className="auth-password-toggle"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-controls="password"
                        title={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((visible) => !visible)}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                            <circle cx="12" cy="12" r="3" />
                            {showPassword && <path d="m3 3 18 18" />}
                        </svg>
                    </button>
                </div>
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
