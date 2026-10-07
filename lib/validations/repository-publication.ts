import { z } from "zod";

export const publicationIdSchema = z.union([
    z.number().int().positive().max(2147483647),
    z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().positive().max(2147483647)),
]);
export const publicationStateSchema = z.enum(["true", "false"]).transform(value => value === "true");
