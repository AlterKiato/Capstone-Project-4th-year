import { z } from "zod";

export const verificationUserIdSchema = z.number().int().positive().max(2147483647);
// Canonical hex encoding of 32 random bytes. No coercion, trimming or URL acceptance.
export const verificationTokenSchema = z.string().length(64).regex(/^[a-f0-9]{64}$/);
export const verificationEmailSchema = z.email().max(255);
