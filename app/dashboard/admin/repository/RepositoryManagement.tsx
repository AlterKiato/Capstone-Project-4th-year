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
        <div aria-busy={publishing || updating}>
            <p>Publish Adviser-approved research to the research repository.</p>

            <p role="status" className={publishState.message ? (publishState.success ? "research-notice" : "form-message") : undefined}>{publishState.message}</p>
            <p role="status" className={updateState.message ? (updateState.success ? "research-notice" : "form-message") : undefined}>{updateState.message}</p>

            <section className="dashboard-panel">
                <h2>Approved research available to publish</h2>
                {eligiblePapers.length === 0 ? (
                    <p>No approved research is waiting for publication.</p>
                ) : (
                    <ul className="management-records">
                        {eligiblePapers.map((paper) => (
                            <li key={paper.paperId}>
                                <h3>{paper.title}</h3>
                                <p>{paper.groupName}</p>
                                <form action={publishAction}>
                                    <input type="hidden" name="paperId" value={paper.paperId} />
                                    <button type="submit" disabled={publishing || updating}>{publishing ? "Publishing..." : "Publish to repository"}</button>
                                </form>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="dashboard-panel">
                <h2>Repository entries</h2>
                {repositoryEntries.length === 0 ? (
                    <p>No repository entries have been created.</p>
                ) : (
                    <ul className="management-records">
                        {repositoryEntries.map((entry) => (
                            <li key={entry.id}>
                                <h3>{entry.title}</h3>
                                <p>{entry.groupName}</p>
                                <p>Status: {entry.isPublished ? "Published" : "Hidden"}</p>
                                <form action={updateAction}>
                                    <input type="hidden" name="repositoryId" value={entry.id} />
                                    <input type="hidden" name="publish" value={String(!entry.isPublished)} />
                                    <button type="submit" disabled={publishing || updating}>
                                        {updating ? "Updating publication..." : entry.isPublished ? "Unpublish" : "Publish"}
                                    </button>
                                </form>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
