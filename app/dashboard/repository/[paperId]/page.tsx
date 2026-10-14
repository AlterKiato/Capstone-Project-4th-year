import { notFound } from "next/navigation";
import Link from "next/link";
import DashboardHeader from "@/components/dashboard/dashboard-header";

import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import {
    getPublishedResearchDetails,
    recordResearchRepositoryView,
} from "@/lib/services/repository.service";
import DownloadRepositoryDocumentButton from "./DownloadRepositoryDocumentButton";

export default async function ResearchRepositoryDetailsPage({
    params,
}: {
    params: Promise<{ paperId: string }>;
}) {
    const session = await requireRole([
        ROLE_IDS.ADMIN,
        ROLE_IDS.ADVISER,
        ROLE_IDS.STUDENT,
        ROLE_IDS.PANEL,
    ]);
    const { paperId: rawPaperId } = await params;
    const paperId = Number(rawPaperId);
    if (!Number.isSafeInteger(paperId) || paperId <= 0) notFound();

    const entry = await getPublishedResearchDetails(paperId);
    if (!entry) notFound();
    await recordResearchRepositoryView(entry.id);

    return (
        <main className="dashboard-page discovery-page">
            <DashboardHeader title={entry.title} email={session.email} />
            <p><Link className="surface-link" href="/dashboard/repository">Back to Repository</Link></p>
            <section className="dashboard-panel" aria-label="Research metadata">
            <p>{entry.groupName} · {entry.strand} · {entry.section} · {entry.schoolYear}</p>
            {entry.category && <p>Category: {entry.category}</p>}
            {entry.keywords && <p>Keywords: {entry.keywords}</p>}
            <p>Published: {entry.publishedAt?.toLocaleDateString() ?? "Not available"}</p>
            </section>
            <section className="dashboard-panel">
                <h2>Abstract</h2>
                <p className="record-text">{entry.abstract}</p>
            </section>
            <section className="dashboard-panel">
            <h2>Research Document</h2>
            <DownloadRepositoryDocumentButton paperId={entry.paperId} />
            </section>
        </main>
    );
}
