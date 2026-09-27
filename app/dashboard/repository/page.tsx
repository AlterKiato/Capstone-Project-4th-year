import Link from "next/link";

import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getPublishedResearch } from "@/lib/services/repository.service";

export default async function ResearchRepositoryPage() {
    await requireRole([
        ROLE_IDS.ADMIN,
        ROLE_IDS.ADVISER,
        ROLE_IDS.STUDENT,
        ROLE_IDS.PANEL,
    ]);
    const entries = await getPublishedResearch();

    return (
        <main style={{ maxWidth: 1000, margin: "0 auto", padding: 32 }}>
            <h1>Research Repository</h1>
            <p>Browse research approved by an Adviser and published by an Admin.</p>
            {entries.length === 0 ? (
                <p>No research has been published yet.</p>
            ) : (
                <ul style={{ display: "grid", gap: 16, padding: 0, listStyle: "none" }}>
                    {entries.map((entry) => (
                        <li key={entry.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 20 }}>
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
        </main>
    );
}
