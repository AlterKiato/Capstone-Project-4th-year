// Zod schemas only

import { z } from "zod";

/**
 * Validates login form data.
 *
 * Login requires a valid email address and
 * a password containing at least 8 characters.
 */
export const loginSchema = z.object({
    email: z
        .email("Invalid email address")
        .trim(),

    password: z
        .string()
        .min(8, "Password must be at least 8 characters long")
        .max(100, "Password must not exceed 100 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Validates registration form data.
 *
 * Role information is intentionally excluded.
 * Public registration always receives the Student
 * role from the authentication service.
 */
export const registerSchema = z
    .object({
        firstName: z
            .string()
            .trim()
            .min(2, "First name must be at least 2 characters long")
            .max(100, "First name must not exceed 100 characters"),

        lastName: z
            .string()
            .trim()
            .min(2, "Last name must be at least 2 characters long")
            .max(100, "Last name must not exceed 100 characters"),

        email: z
            .email("Invalid email address")
            .trim(),

        password: z
            .string()
            .min(8, "Password must be at least 8 characters long")
            .max(100, "Password must not exceed 100 characters"),

        confirmPassword: z
            .string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    });

export type RegisterInput = z.infer<typeof registerSchema>;