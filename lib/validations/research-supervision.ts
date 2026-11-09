import { z } from "zod";

export const designateMainAdviserSchema = z.object({
    mainAdviserId: z.number().int().positive().max(2147483647),
    expectedRevision: z.number().int().min(0).max(2147483646),
    confirmed: z.literal(true),
}).strict();
