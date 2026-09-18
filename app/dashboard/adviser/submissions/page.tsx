import Link from "next/link";

import {
    requireRole,
} from "@/lib/auth/authorization";

import {
    ROLE_IDS,
} from "@/lib/auth/roles";

import {
    getAdviserSubmissions,
} from "@/lib/services/adviser-submission.service";

/**
 * Displays research submissions belonging
 * to the authenticated Adviser's groups.
 */
export default async function AdviserSubmissionsPage() {
    const session =
        await requireRole([
            ROLE_IDS.ADVISER,
        ]);

    const result =
        await getAdviserSubmissions(
            session.userId
        );

    const submissions =
        result.data ?? [];

    return (
        <main
            style={{
                maxWidth: "1200px",
                margin: "0 auto",
                padding: "40px 20px",
            }}
        >
            <h1>
                Research Submissions
            </h1>

            <p>
                Review research submissions
                from your research groups.
            </p>

            <hr
                style={{
                    margin: "30px 0",
                }}
            />

            {submissions.length === 0 ? (
                <section>
                    <h2>
                        No Submissions
                    </h2>

                    <p>
                        There are currently no
                        research submissions from
                        your research groups.
                    </p>
                </section>
            ) : (
                <section>
                    <h2>
                        Submitted Research
                    </h2>

                    <div
                        style={{
                            overflowX:
                                "auto",
                            marginTop:
                                "20px",
                        }}
                    >
                        <table
                            style={{
                                width: "100%",
                                borderCollapse:
                                    "collapse",
                            }}
                        >
                            <thead>
                                <tr>
                                    <th>
                                        Research
                                    </th>

                                    <th>
                                        Student
                                    </th>

                                    <th>
                                        Research Group
                                    </th>

                                    <th>
                                        Version
                                    </th>

                                    <th>
                                        Status
                                    </th>

                                    <th>
                                        Submitted At
                                    </th>

                                    <th>
                                        Action
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {submissions.map(
                                    (
                                        submission
                                    ) => (
                                        <tr
                                            key={
                                                submission.id
                                            }
                                        >
                                            <td>
                                                {
                                                    submission.researchTitle
                                                }
                                            </td>

                                            <td>
                                                {
                                                    submission.studentFirstName
                                                }{" "}
                                                {
                                                    submission.studentLastName
                                                }
                                            </td>

                                            <td>
                                                {
                                                    submission.groupName
                                                }
                                            </td>

                                            <td>
                                                {
                                                    submission.version
                                                }
                                            </td>

                                            <td>
                                                {
                                                    submission.status
                                                }
                                            </td>

                                            <td>
                                                {submission.submittedAt.toLocaleString()}
                                            </td>

                                            <td>
                                                <Link
                                                    href={`/dashboard/adviser/submissions/${submission.id}`}
                                                >
                                                    View
                                                </Link>
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </main>
    );
}