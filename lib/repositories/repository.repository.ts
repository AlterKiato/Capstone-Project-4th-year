import {
    asc,
    and,
    count,
    desc,
    eq,
    exists,
    ilike,
    isNull,
    or,
    sql,
} from "drizzle-orm";

import { db } from "@/lib/db";
import {
    repositories,
    researchGroups,
    researchPapers,
    submissions,
} from "@/db/schema";
import {
    RESEARCH_STATUS,
} from "@/lib/constants/research-status";
import {
    SUBMISSION_STATUS,
} from "@/lib/constants/submission-status";
import { REPOSITORY_PAGE_SIZE } from "@/lib/constants/repository";
import type { RepositorySearchCriteria } from "@/types/repository";

function publishedApprovedCondition(
    criteria?: RepositorySearchCriteria
) {
    const approvedSubmission = db
        .select({ id: submissions.id })
        .from(submissions)
        .where(and(
            eq(submissions.paperId, researchPapers.id),
            eq(submissions.status, SUBMISSION_STATUS.APPROVED)
        ));

    const conditions = [
        eq(repositories.isPublished, true),
        eq(researchPapers.status, RESEARCH_STATUS.APPROVED),
        exists(approvedSubmission),
    ];

    if (criteria?.category) {
        conditions.push(eq(researchPapers.category, criteria.category));
    }
    if (criteria?.schoolYear) {
        conditions.push(eq(researchGroups.schoolYear, criteria.schoolYear));
    }
    if (criteria?.strand) {
        conditions.push(eq(researchGroups.strand, criteria.strand));
    }
    if (criteria?.search) {
        const escapedSearch = criteria.search.replace(/[\\%_]/g, "\\$&");
        const pattern = `%${escapedSearch}%`;
        conditions.push(or(
            ilike(researchPapers.title, pattern),
            ilike(researchPapers.abstract, pattern),
            ilike(researchPapers.keywords, pattern)
        )!);
    }

    return and(...conditions);
}

function findPublishedResearchSubquery(criteria: RepositorySearchCriteria) {
    const latestApprovedSubmissionAt = db
        .select({ latestSubmittedAt: sql<Date>`max(${submissions.submittedAt})` })
        .from(submissions)
        .where(and(
            eq(submissions.paperId, researchPapers.id),
            eq(submissions.status, SUBMISSION_STATUS.APPROVED)
        ));

    return db
        .selectDistinctOn([researchPapers.id], {
            id: sql<number>`${repositories.id}`.as("repository_id"),
            paperId: sql<number>`${researchPapers.id}`.as("paper_id"),
            title: researchPapers.title,
            abstract: researchPapers.abstract,
            category: researchPapers.category,
            keywords: researchPapers.keywords,
            groupName: researchGroups.groupName,
            strand: researchGroups.strand,
            section: researchGroups.section,
            schoolYear: researchGroups.schoolYear,
            publishedAt: repositories.publishedAt,
            sortDate: sql<Date>`coalesce(${repositories.publishedAt}, (${latestApprovedSubmissionAt}))`.as("sort_date"),
            viewCount: repositories.viewCount,
        })
        .from(repositories)
        .innerJoin(
            researchPapers,
            eq(repositories.paperId, researchPapers.id)
        )
        .innerJoin(
            researchGroups,
            eq(researchPapers.groupId, researchGroups.id)
        )
        .where(publishedApprovedCondition(criteria))
        .orderBy(
            asc(researchPapers.id),
            desc(sql`coalesce(${repositories.publishedAt}, (${latestApprovedSubmissionAt}))`),
            desc(repositories.id)
        )
        .as("published_research");
}

export async function findPublishedResearchPage(
    criteria: RepositorySearchCriteria
) {
    const publishedResearch = findPublishedResearchSubquery(criteria);
    const [countResult] = await db
        .select({ total: count() })
        .from(publishedResearch);
    const total = countResult?.total ?? 0;
    const pageCount = Math.ceil(total / REPOSITORY_PAGE_SIZE);
    const page = pageCount === 0 ? 1 : Math.min(criteria.page, pageCount);

    const items = total === 0
        ? []
        : await db
            .select({
                id: publishedResearch.id,
                paperId: publishedResearch.paperId,
                title: publishedResearch.title,
                abstract: publishedResearch.abstract,
                category: publishedResearch.category,
                keywords: publishedResearch.keywords,
                groupName: publishedResearch.groupName,
                strand: publishedResearch.strand,
                section: publishedResearch.section,
                schoolYear: publishedResearch.schoolYear,
                publishedAt: publishedResearch.publishedAt,
                viewCount: publishedResearch.viewCount,
            })
            .from(publishedResearch)
            .orderBy(desc(publishedResearch.sortDate), desc(publishedResearch.paperId))
            .limit(REPOSITORY_PAGE_SIZE)
            .offset((page - 1) * REPOSITORY_PAGE_SIZE);

    return { items, total, page, pageCount };
}

export async function findPublishedRepositoryFilterOptions() {
    const [categories, schoolYears, strands] = await Promise.all([
        db
            .selectDistinct({ value: researchPapers.category })
            .from(repositories)
            .innerJoin(researchPapers, eq(repositories.paperId, researchPapers.id))
            .innerJoin(researchGroups, eq(researchPapers.groupId, researchGroups.id))
            .where(publishedApprovedCondition())
            .orderBy(asc(researchPapers.category)),
        db
            .selectDistinct({ value: researchGroups.schoolYear })
            .from(repositories)
            .innerJoin(researchPapers, eq(repositories.paperId, researchPapers.id))
            .innerJoin(researchGroups, eq(researchPapers.groupId, researchGroups.id))
            .where(publishedApprovedCondition())
            .orderBy(asc(researchGroups.schoolYear)),
        db
            .selectDistinct({ value: researchGroups.strand })
            .from(repositories)
            .innerJoin(researchPapers, eq(repositories.paperId, researchPapers.id))
            .innerJoin(researchGroups, eq(researchPapers.groupId, researchGroups.id))
            .where(publishedApprovedCondition())
            .orderBy(asc(researchGroups.strand)),
    ]);

    return {
        categories: categories.flatMap(({ value }) => value ? [value] : []),
        schoolYears: schoolYears.map(({ value }) => value),
        strands: strands.map(({ value }) => value),
    };
}

export async function findApprovedPapersForRepository() {
    return db
        .selectDistinctOn([researchPapers.id], {
            paperId: researchPapers.id,
            title: researchPapers.title,
            groupName: researchGroups.groupName,
            createdAt: researchPapers.createdAt,
            version: submissions.version,
            fileUrl: submissions.fileUrl,
        })
        .from(researchPapers)
        .innerJoin(
            researchGroups,
            eq(researchPapers.groupId, researchGroups.id)
        )
        .leftJoin(
            repositories,
            eq(repositories.paperId, researchPapers.id)
        )
        .innerJoin(
            submissions,
            eq(submissions.paperId, researchPapers.id)
        )
        .where(and(
            eq(researchPapers.status, RESEARCH_STATUS.APPROVED),
            eq(submissions.status, SUBMISSION_STATUS.APPROVED),
            isNull(repositories.id)
        ))
        .orderBy(researchPapers.id, desc(submissions.submittedAt), desc(submissions.id));
}

export async function findRepositoryManagementEntries() {
    return db
        .select({
            id: repositories.id,
            paperId: researchPapers.id,
            title: researchPapers.title,
            groupName: researchGroups.groupName,
            isPublished: repositories.isPublished,
            publishedAt: repositories.publishedAt,
        })
        .from(repositories)
        .innerJoin(
            researchPapers,
            eq(repositories.paperId, researchPapers.id)
        )
        .innerJoin(
            researchGroups,
            eq(researchPapers.groupId, researchGroups.id)
        )
        .orderBy(desc(repositories.publishedAt));
}

export async function findPublishedRepositoryEntry(paperId: number) {
    const [entry] = await db
        .select({
            id: repositories.id,
            paperId: researchPapers.id,
            title: researchPapers.title,
            abstract: researchPapers.abstract,
            category: researchPapers.category,
            keywords: researchPapers.keywords,
            groupName: researchGroups.groupName,
            strand: researchGroups.strand,
            section: researchGroups.section,
            schoolYear: researchGroups.schoolYear,
            publishedAt: repositories.publishedAt,
            viewCount: repositories.viewCount,
            submissionId: submissions.id,
            version: submissions.version,
            fileUrl: submissions.fileUrl,
            submittedAt: submissions.submittedAt,
        })
        .from(repositories)
        .innerJoin(
            researchPapers,
            eq(repositories.paperId, researchPapers.id)
        )
        .innerJoin(
            researchGroups,
            eq(researchPapers.groupId, researchGroups.id)
        )
        .innerJoin(
            submissions,
            eq(submissions.paperId, researchPapers.id)
        )
        .where(and(
            eq(researchPapers.id, paperId),
            eq(repositories.isPublished, true),
            eq(researchPapers.status, RESEARCH_STATUS.APPROVED),
            eq(submissions.status, SUBMISSION_STATUS.APPROVED)
        ))
        .orderBy(desc(submissions.submittedAt), desc(submissions.id))
        .limit(1);

    return entry;
}

export async function incrementRepositoryViewCount(repositoryId: number) {
    await db
        .update(repositories)
        .set({ viewCount: sql`${repositories.viewCount} + 1` })
        .where(eq(repositories.id, repositoryId));
}

export async function incrementRepositoryDownloadCount(repositoryId: number) {
    await db
        .update(repositories)
        .set({ downloadCount: sql`${repositories.downloadCount} + 1` })
        .where(eq(repositories.id, repositoryId));
}
