// Synthetic only: no database, account approvals, documents or storage fixtures.
import type { AdminAggregate, AdviserAggregate } from "../../lib/validations/ai-foundation";
export const adminFixture: AdminAggregate = {
    totalUsers: 5, totalGroups: 10, totalResearchPapers: 15, approvedPapers: 10, totalPublishedPapers: 5,
};
export type SyntheticVersion = { owner: number; contributor: number; paper: number; status: string };
export function versionFixture(owner: number, submitted = 5, review = 5, other = 5): SyntheticVersion[] {
    return Array.from({ length: submitted + review + other }, (_, index) => ({
        owner, contributor: owner * 10000 + index, paper: owner * 10000 + index,
        status: index < submitted ? "Submitted" : index < submitted + review ? "Under Review" : "Approved",
    }));
}
export function aggregateFixture(rows: SyntheticVersion[], owner: number): AdviserAggregate {
    const owned = rows.filter(row => row.owner === owner);
    const cohort = (subset: SyntheticVersion[]) => ({ versions: subset.length,
        contributors: new Set(subset.map(row => row.contributor)).size,
        papers: new Set(subset.map(row => row.paper)).size });
    return {
        total: cohort(owned), submitted: cohort(owned.filter(row => row.status === "Submitted")),
        review: cohort(owned.filter(row => row.status === "Under Review")),
        notSubmitted: cohort(owned.filter(row => row.status !== "Submitted")),
        notReview: cohort(owned.filter(row => row.status !== "Under Review")),
        neither: cohort(owned.filter(row => !["Submitted", "Under Review"].includes(row.status))),
    };
}
