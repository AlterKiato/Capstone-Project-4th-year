import Link from "next/link";
import DashboardHeader from "@/components/dashboard/dashboard-header";

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
    params.set("page", String(page));
    return `/dashboard/repository?${params.toString()}`;
}

export default async function ResearchRepositoryPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const session = await requireRole([
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
        <main className="dashboard-page discovery-page">
            <DashboardHeader title="Research Repository" email={session.email} />
            <p><Link className="surface-link" href="/dashboard">Back to Dashboard</Link></p>
            <p className="dashboard-context">Browse research approved by an Adviser and published by an Admin.</p>

            <form method="get" action="/dashboard/repository" className="dashboard-panel dashboard-form" aria-describedby="filter-help">
                <h2>Search and Filter</h2>
                <p id="filter-help" className="form-help">Search title, abstract or keywords. Combine filters to narrow the results; papers are shown newest first.</p>
                <label>
                    Search title, abstract, or keywords
                    <input
                        type="search"
                        name="search"
                        maxLength={200}
                        defaultValue={criteria.search}
                        className="discovery-control"
                    />
                </label>
                <div className="discovery-filters">
                    <div>
                        <label htmlFor="repository-category">Category</label>
                        <select id="repository-category" name="category" defaultValue={criteria.category} className="discovery-control">
                            <option value="">All categories</option>
                            {criteria.category && !filterOptions.categories.includes(criteria.category) && (
                                <option value={criteria.category}>{criteria.category}</option>
                            )}
                            {filterOptions.categories.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="repository-year">School year</label>
                        <select id="repository-year" name="schoolYear" defaultValue={criteria.schoolYear} className="discovery-control">
                            <option value="">All school years</option>
                            {criteria.schoolYear && !filterOptions.schoolYears.includes(criteria.schoolYear) && (
                                <option value={criteria.schoolYear}>{criteria.schoolYear}</option>
                            )}
                            {filterOptions.schoolYears.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="repository-strand">Strand</label>
                        <select id="repository-strand" name="strand" defaultValue={criteria.strand} className="discovery-control">
                            <option value="">All strands</option>
                            {criteria.strand && !filterOptions.strands.includes(criteria.strand) && (
                                <option value={criteria.strand}>{criteria.strand}</option>
                            )}
                            {filterOptions.strands.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                    </div>
                </div>
                <button type="submit">Search and filter</button>
            </form>
            <form method="get" action="/dashboard/repository" className="surface-actions">
                <button type="submit">Clear filters</button>
            </form>

            <p aria-live="polite" className="result-context">Showing {firstResult}–{lastResult} of {results.total} research papers</p>
            {results.items.length === 0 ? (
                <section aria-live="polite" className="dashboard-panel">
                    <p>No results match your search and filters.</p>
                    <form method="get" action="/dashboard/repository">
                        <button type="submit">Clear filters</button>
                    </form>
                </section>
            ) : (
                <ul className="repository-results">
                    {results.items.map((entry) => (
                        <li key={entry.paperId}>
                            <h2>
                                <Link href={`/dashboard/repository/${entry.paperId}`}>
                                    {entry.title}
                                </Link>
                            </h2>
                            <p>{entry.groupName} · {entry.strand} · {entry.schoolYear}</p>
                            {entry.category && <p>Category: {entry.category}</p>}
                            <p className="record-text">{entry.abstract}</p>
                        </li>
                    ))}
                </ul>
            )}

            {results.pageCount > 1 && (
                <nav aria-label="Repository result pages" className="repository-pagination">
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
