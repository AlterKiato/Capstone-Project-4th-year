import { z } from "zod";

import type { RepositorySearchCriteria } from "@/types/repository";

const searchParamsSchema = z.object({
    search: z.string().trim().max(200).catch("").default(""),
    category: z.string().trim().max(100).catch("").default(""),
    schoolYear: z.string().trim().max(20).catch("").default(""),
    strand: z.string().trim().max(50).catch("").default(""),
    sort: z.enum(["newest", "oldest", "title"]).catch("newest").default("newest"),
    page: z.coerce.number().int().min(1).max(1_000_000).catch(1).default(1),
});

export function parseRepositorySearchParams(
    rawParams: Record<string, string | string[] | undefined>
): RepositorySearchCriteria {
    const singleValues = Object.fromEntries(
        Object.entries(rawParams).map(([key, value]) => [
            key,
            Array.isArray(value) ? value[0] : value,
        ])
    );

    const parsed = searchParamsSchema.safeParse(singleValues);
    return parsed.success ? parsed.data : searchParamsSchema.parse({});
}
