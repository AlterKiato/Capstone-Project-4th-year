import Link from "next/link";
import LocalAIAssistance from "@/components/dashboard/local-ai-assistance";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getAdviserSubmissions } from "@/lib/services/adviser-submission.service";

export default async function AdviserSubmissionsPage() {
    const session = await requireRole([ROLE_IDS.ADVISER]);
    const result = await getAdviserSubmissions(session.userId);
    const submissions = result.data ?? [];
    return (
        <main className="dashboard-page research-workspace">
            <DashboardHeader title="Research Submissions" email={session.email} />
            <p className="dashboard-context">Open a submitted version to read its PDF, start review and record your feedback and decision.</p>
            <section className="dashboard-panel" aria-labelledby="submissions-heading">
                <h2 id="submissions-heading">Submitted Research</h2>
                {!result.success ? (
                    <p className="form-message" role="alert">{result.message}</p>
                ) : submissions.length === 0 ? (
                    <p>No research submissions from your groups yet. Submitted versions will appear here when a Student uploads a document.</p>
                ) : (
                    <>
                        <p id="table-help" className="form-help">Newest submissions first. On a narrow screen, scroll within the table to reach all columns.</p>
                        <div className="research-table-scroll" role="region" aria-labelledby="submissions-heading" aria-describedby="table-help" tabIndex={0}>
                            <table className="research-table">
                                <caption className="sr-only">Submissions from your research groups</caption>
                                <thead><tr>
                                    <th scope="col">Research</th><th scope="col">Student</th><th scope="col">Research Group</th>
                                    <th scope="col">Version</th><th scope="col">Status</th><th scope="col">Submitted</th><th scope="col">Review</th>
                                </tr></thead>
                                <tbody>{submissions.map(submission => (
                                    <tr key={submission.id}>
                                        <th scope="row"><Link href={`/dashboard/adviser/submissions/${submission.id}`}>{submission.researchTitle}</Link></th>
                                        <td>{submission.studentFirstName} {submission.studentLastName}</td>
                                        <td>{submission.groupName}</td><td>{submission.version}</td><td>{submission.status}</td>
                                        <td><time dateTime={submission.submittedAt.toISOString()}>{submission.submittedAt.toLocaleString()}</time></td>
                                        <td><Link href={`/dashboard/adviser/submissions/${submission.id}`} aria-label={`Review ${submission.researchTitle}, ${submission.version}`}>View Details</Link></td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    </>
                )}
            </section>
            <LocalAIAssistance feature="adviser" />
        </main>
    );
}
