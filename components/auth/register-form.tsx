"use client";

import { useActionState, useState } from "react";

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
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmationPassword, setShowConfirmationPassword] = useState(false);
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

                <div className="auth-password-field">
                    <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={100}
                        aria-describedby="password-help"
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
                <p id="password-help" className="form-help">Use 8–100 characters.</p>
            </div>

            <div>
                <label htmlFor="confirmPassword">
                    Confirm Password
                </label>

                <div className="auth-password-field">
                    <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmationPassword ? "text" : "password"}
                        autoComplete="new-password"
                        aria-describedby="confirm-help"
                        required
                    />
                    <button
                        type="button"
                        className="auth-password-toggle"
                        aria-label={showConfirmationPassword ? "Hide confirmation password" : "Show confirmation password"}
                        aria-controls="confirmPassword"
                        title={showConfirmationPassword ? "Hide confirmation password" : "Show confirmation password"}
                        onClick={() => setShowConfirmationPassword((visible) => !visible)}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                            <circle cx="12" cy="12" r="3" />
                            {showConfirmationPassword && <path d="m3 3 18 18" />}
                        </svg>
                    </button>
                </div>
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
