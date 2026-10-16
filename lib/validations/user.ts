import { z } from "zod";
import { registerSchema } from "@/lib/validations/auth";
// Reuse registration rules, including password confirmation; privileged roles only.
export const managedAccountSchema = registerSchema.safeExtend({ roleId: z.union([z.literal(1), z.literal(2)]) }).strict();

const userId = z.number().int().positive().max(2147483647);
export const userRoleChangeSchema = z.strictObject({ userId, roleId: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]) });
export const userStatusChangeSchema = z.strictObject({ userId, isActive: z.boolean() });
