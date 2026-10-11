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
        <form action={formAction} className="dashboard-form auth-form" aria-busy={isPending} aria-describedby="register-message">
            <p className="form-help">All fields are required. Names must contain 2–100 characters.</p>
            <div>
                <label htmlFor="firstName">
                    First Name
                </label>

                <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    minLength={2}
                    maxLength={100}
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
                    autoComplete="family-name"
                    minLength={2}
                    maxLength={100}
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
                    autoComplete="email"
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
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={100}
                    aria-describedby="password-help"
                    required
                />
                <p id="password-help" className="form-help">Use 8–100 characters.</p>
            </div>

            <div>
                <label htmlFor="confirmPassword">
                    Confirm Password
                </label>

                <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    aria-describedby="confirm-help"
                    required
                />
                <p id="confirm-help" className="form-help">Enter the same password again.</p>
            </div>

            <p id="register-message" className={state.message ? "form-message" : undefined} aria-live="polite" aria-atomic="true">{state.message}</p>

            <button
                type="submit"
                disabled={isPending}
            >
                {isPending ? "Creating account..." : "Create Student account"}
            </button>
        </form>
    );
}
