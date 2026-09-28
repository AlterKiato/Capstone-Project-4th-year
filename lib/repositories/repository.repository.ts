import {
    and,
    desc,
    eq,
    isNull,
} from "drizzle-orm";
import { sql } from "drizzle-orm";

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

export async function findApprovedPapersForRepository() {
    return db
        .select({
            paperId: researchPapers.id,
            title: researchPapers.title,
            groupName: researchGroups.groupName,
            createdAt: researchPapers.createdAt,
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
        .orderBy(desc(researchPapers.updatedAt));
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

export async function findPublishedRepositoryEntries() {
    const rows = await db
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
            eq(repositories.isPublished, true),
            eq(researchPapers.status, RESEARCH_STATUS.APPROVED),
            eq(submissions.status, SUBMISSION_STATUS.APPROVED)
        ))
        .orderBy(desc(repositories.publishedAt), desc(submissions.submittedAt));

    const latestEntryByPaper = new Map<number, (typeof rows)[number]>();
    for (const row of rows) {
        if (!latestEntryByPaper.has(row.paperId)) {
            latestEntryByPaper.set(row.paperId, row);
        }
    }
    return [...latestEntryByPaper.values()];
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
        .orderBy(desc(submissions.submittedAt))
        .limit(1);

    return entry;
}

export async function publishApprovedPaper(paperId: number) {
    const [paper] = await db
        .select({ id: researchPapers.id })
        .from(researchPapers)
        .innerJoin(
            submissions,
            eq(submissions.paperId, researchPapers.id)
        )
        .where(and(
            eq(researchPapers.id, paperId),
            eq(researchPapers.status, RESEARCH_STATUS.APPROVED),
            eq(submissions.status, SUBMISSION_STATUS.APPROVED)
        ));
    if (!paper) return null;

    const [created] = await db
        .insert(repositories)
        .values({
            paperId,
            isPublished: true,
            publishedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: repositories.paperId,
            set: { isPublished: true, publishedAt: new Date() },
        })
        .returning();
    return created;
}

export async function setRepositoryPublished(
    repositoryId: number,
    isPublished: boolean
) {
    const eligibilityQuery = db
        .select({ id: repositories.id })
        .from(repositories);

    const [entry] = isPublished
        ? await eligibilityQuery
            .innerJoin(
                researchPapers,
                eq(repositories.paperId, researchPapers.id)
            )
            .innerJoin(
                submissions,
                eq(submissions.paperId, researchPapers.id)
            )
            .where(and(
                eq(repositories.id, repositoryId),
                eq(researchPapers.status, RESEARCH_STATUS.APPROVED),
                eq(submissions.status, SUBMISSION_STATUS.APPROVED)
            ))
        : await eligibilityQuery
            .where(eq(repositories.id, repositoryId));
    if (!entry) return null;

    const [updated] = await db
        .update(repositories)
        .set({
            isPublished,
            publishedAt: isPublished ? new Date() : null,
        })
        .where(eq(repositories.id, repositoryId))
        .returning();
    return updated;
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
