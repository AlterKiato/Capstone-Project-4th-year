import { notFound } from "next/navigation";

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
    await requireRole([
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
        <main style={{ maxWidth: 900, margin: "0 auto", padding: 32 }}>
            <h1>{entry.title}</h1>
            <p>{entry.groupName} · {entry.strand} · {entry.section} · {entry.schoolYear}</p>
            {entry.category && <p>Category: {entry.category}</p>}
            {entry.keywords && <p>Keywords: {entry.keywords}</p>}
            <section>
                <h2>Abstract</h2>
                <p style={{ whiteSpace: "pre-wrap" }}>{entry.abstract}</p>
            </section>
            <p>Published: {entry.publishedAt?.toLocaleDateString() ?? "—"}</p>
            <DownloadRepositoryDocumentButton paperId={entry.paperId} />
        </main>
    );
}
