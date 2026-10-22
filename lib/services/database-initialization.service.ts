// Operator entry only; no Server Action, route, runtime database import or automatic startup hook.
import { registerSchema } from "@/lib/validations/auth";
import { hashPassword } from "@/lib/auth/hash";
import { insertInitialAdmin, type InitializationDatabase } from "@/lib/repositories/database-initialization.repository";

export async function bootstrapInitialAdmin(database: InitializationDatabase, input: unknown) {
    const normalized = input && typeof input === "object" && !Array.isArray(input) ? { ...input } as Record<string, unknown> : {};
    if (typeof normalized.email === "string") normalized.email = normalized.email.trim().toLowerCase();
    const parsed = registerSchema.safeParse(normalized);
    if (!parsed.success) return { success: false, message: "Invalid Admin details. Check the account and password requirements." } as const;
    try {
        const data = parsed.data;
        const passwordHash = await hashPassword(data.password);
        const id = await insertInitialAdmin(database, { firstName: data.firstName, lastName: data.lastName, email: data.email, passwordHash });
        return { success: true, message: "Initial Admin created.", id } as const;
    } catch {
        // Includes uncertain commit acknowledgements: never expose database details or automatically retry.
        return { success: false, message: "Admin creation could not be confirmed. Inspect the approved database before retrying." } as const;
    }
}
