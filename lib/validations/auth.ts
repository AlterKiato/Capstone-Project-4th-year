import { z } from "zod";

export const loginSchema = z.object({
    email: z 
    .email("Invalid email address")
    .trim(),

    password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(100),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
    firstName: z
    .string()
    .min(2)
    .max(100),

    lastName: z
    .string()
    .min(2)
    .max(100),

    email: z
    .email()
    .trim(),

    password: z
    .string()
    .min(8)
    .max(100),

    confirmPassword: z
    .string(),

    roleId: z
    .number()
})

    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
});