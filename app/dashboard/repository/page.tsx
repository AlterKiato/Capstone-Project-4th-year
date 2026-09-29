import Link from "next/link";

import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { REPOSITORY_PAGE_SIZE } from "@/lib/constants/repository";
import {
    getPublishedResearch,
    getPublishedResearchFilterOptions,
} from "@/lib/services/repository.service";
import { parseRepositorySearchParams } from "@/lib/validations/repository";
import type { RepositorySearchCriteria } from "@/types/repository";

function pageHref(criteria: RepositorySearchCriteria, page: number) {
    const params = new URLSearchParams();
    if (criteria.search) params.set("search", criteria.search);
    if (criteria.category) params.set("category", criteria.category);
    if (criteria.schoolYear) params.set("schoolYear", criteria.schoolYear);
    if (criteria.strand) params.set("strand", criteria.strand);
    params.set("sort", criteria.sort);
    params.set("page", String(page));
    return `/dashboard/repository?${params.toString()}`;
}

export default async function ResearchRepositoryPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await requireRole([
        ROLE_IDS.ADMIN,
        ROLE_IDS.ADVISER,
        ROLE_IDS.STUDENT,
        ROLE_IDS.PANEL,
    ]);
    const criteria = parseRepositorySearchParams(await searchParams);
    const [results, filterOptions] = await Promise.all([
        getPublishedResearch(criteria),
        getPublishedResearchFilterOptions(),
    ]);
    const firstResult = results.total === 0
        ? 0
        : (results.page - 1) * REPOSITORY_PAGE_SIZE + 1;
    const lastResult = Math.min(results.page * REPOSITORY_PAGE_SIZE, results.total);

    return (
        <main style={{ maxWidth: 1000, margin: "0 auto", padding: 32 }}>
            <h1>Research Repository</h1>
            <p>Browse research approved by an Adviser and published by an Admin.</p>

            <form method="get" action="/dashboard/repository" style={{ display: "grid", gap: 12, margin: "24px 0" }}>
                <label>
                    Search title, abstract, or keywords
                    <input
                        type="search"
                        name="search"
                        maxLength={200}
                        defaultValue={criteria.search}
                        style={{ display: "block", width: "100%", marginTop: 4 }}
                    />
                </label>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    <label>
                        Category
                        <select name="category" defaultValue={criteria.category} style={{ display: "block", width: "100%", marginTop: 4 }}>
                            <option value="">All categories</option>
                            {criteria.category && !filterOptions.categories.includes(criteria.category) && (
                                <option value={criteria.category}>{criteria.category}</option>
                            )}
                            {filterOptions.categories.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                    </label>
                    <label>
                        School year
                        <select name="schoolYear" defaultValue={criteria.schoolYear} style={{ display: "block", width: "100%", marginTop: 4 }}>
                            <option value="">All school years</option>
                            {criteria.schoolYear && !filterOptions.schoolYears.includes(criteria.schoolYear) && (
                                <option value={criteria.schoolYear}>{criteria.schoolYear}</option>
                            )}
                            {filterOptions.schoolYears.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                    </label>
                    <label>
                        Strand
                        <select name="strand" defaultValue={criteria.strand} style={{ display: "block", width: "100%", marginTop: 4 }}>
                            <option value="">All strands</option>
                            {criteria.strand && !filterOptions.strands.includes(criteria.strand) && (
                                <option value={criteria.strand}>{criteria.strand}</option>
                            )}
                            {filterOptions.strands.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                    </label>
                    <label>
                        Sort by
                        <select name="sort" defaultValue={criteria.sort} style={{ display: "block", width: "100%", marginTop: 4 }}>
                            <option value="newest">Newest first</option>
                            <option value="oldest">Oldest first</option>
                            <option value="title">Title A–Z</option>
                        </select>
                    </label>
                </div>
                <button type="submit" style={{ justifySelf: "start" }}>Search and filter</button>
            </form>
            <form method="get" action="/dashboard/repository" style={{ marginTop: -12, marginBottom: 24 }}>
                <button type="submit">Clear filters</button>
            </form>

            <p aria-live="polite">Showing {firstResult}–{lastResult} of {results.total} research papers</p>
            {results.items.length === 0 ? (
                <section aria-live="polite">
                    <p>No results match your search and filters.</p>
                    <form method="get" action="/dashboard/repository">
                        <button type="submit">Clear filters</button>
                    </form>
                </section>
            ) : (
                <ul style={{ display: "grid", gap: 16, padding: 0, listStyle: "none" }}>
                    {results.items.map((entry) => (
                        <li key={entry.paperId} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 20 }}>
                            <h2 style={{ marginTop: 0 }}>
                                <Link href={`/dashboard/repository/${entry.paperId}`}>
                                    {entry.title}
                                </Link>
                            </h2>
                            <p>{entry.groupName} · {entry.strand} · {entry.schoolYear}</p>
                            {entry.category && <p>Category: {entry.category}</p>}
                            <p>{entry.abstract}</p>
                        </li>
                    ))}
                </ul>
            )}

            {results.pageCount > 1 && (
                <nav aria-label="Repository result pages" style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 24 }}>
                    {results.page > 1 ? (
                        <Link rel="prev" href={pageHref(criteria, results.page - 1)}>Previous</Link>
                    ) : <span aria-disabled="true">Previous</span>}
                    <span>Page {results.page} of {results.pageCount}</span>
                    {results.page < results.pageCount ? (
                        <Link rel="next" href={pageHref(criteria, results.page + 1)}>Next</Link>
                    ) : <span aria-disabled="true">Next</span>}
                </nav>
            )}
        </main>
    );
}
