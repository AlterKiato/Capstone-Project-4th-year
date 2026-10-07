"use client";

import { useActionState } from "react";
import {
    publishRepositoryPaperAction,
    updateRepositoryPublicationAction,
} from "@/lib/actions/repository.action";
import type { getRepositoryManagementData } from "@/lib/services/repository.service";

export default function RepositoryManagement({ eligiblePapers, repositoryEntries }: NonNullable<Awaited<ReturnType<typeof getRepositoryManagementData>>>) {
    const [publishState, publishAction, publishing] = useActionState(publishRepositoryPaperAction, { success: false, message: "" });
    const [updateState, updateAction, updating] = useActionState(updateRepositoryPublicationAction, { success: false, message: "" });
    return (
        <main style={{ maxWidth: 1000, margin: "0 auto", padding: 32 }}>
            <h1>Repository Management</h1>
            <p>Publish Adviser-approved research to the research repository.</p>

            <p role="status">{publishState.message}</p>
            <p role="status">{updateState.message}</p>

            <section>
                <h2>Approved research available to publish</h2>
                {eligiblePapers.length === 0 ? (
                    <p>No approved research is waiting for publication.</p>
                ) : (
                    <ul style={{ display: "grid", gap: 12, padding: 0, listStyle: "none" }}>
                        {eligiblePapers.map((paper) => (
                            <li key={paper.paperId} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
                                <h3>{paper.title}</h3>
                                <p>{paper.groupName}</p>
                                <form action={publishAction}>
                                    <input type="hidden" name="paperId" value={paper.paperId} />
                                    <button type="submit" disabled={publishing || updating}>Publish to repository</button>
                                </form>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section>
                <h2>Repository entries</h2>
                {repositoryEntries.length === 0 ? (
                    <p>No repository entries have been created.</p>
                ) : (
                    <ul style={{ display: "grid", gap: 12, padding: 0, listStyle: "none" }}>
                        {repositoryEntries.map((entry) => (
                            <li key={entry.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
                                <h3>{entry.title}</h3>
                                <p>{entry.groupName}</p>
                                <p>Status: {entry.isPublished ? "Published" : "Hidden"}</p>
                                <form action={updateAction}>
                                    <input type="hidden" name="repositoryId" value={entry.id} />
                                    <input type="hidden" name="publish" value={String(!entry.isPublished)} />
                                    <button type="submit">
                                        {entry.isPublished ? "Unpublish" : "Publish"}
                                    </button>
                                </form>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </main>
    );
}
