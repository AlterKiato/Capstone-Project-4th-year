import { z } from "zod";
import { registerSchema } from "@/lib/validations/auth";
// Reuse registration rules, including password confirmation; privileged roles only.
export const managedAccountSchema = registerSchema.safeExtend({ roleId: z.union([z.literal(1), z.literal(2)]) }).strict();
