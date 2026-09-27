import {
    publishRepositoryPaperAction,
    updateRepositoryPublicationAction,
} from "@/lib/actions/repository.action";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getRepositoryManagementData } from "@/lib/services/repository.service";

export default async function AdminRepositoryPage() {
    await requireRole([ROLE_IDS.ADMIN]);
    const { eligiblePapers, repositoryEntries } =
        await getRepositoryManagementData();

    return (
        <main style={{ maxWidth: 1000, margin: "0 auto", padding: 32 }}>
            <h1>Repository Management</h1>
            <p>Publish Adviser-approved research to the research repository.</p>

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
                                <form action={publishRepositoryPaperAction}>
                                    <input type="hidden" name="paperId" value={paper.paperId} />
                                    <button type="submit">Publish to repository</button>
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
                                <form action={updateRepositoryPublicationAction}>
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
