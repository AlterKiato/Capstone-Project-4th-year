import Link from "next/link";

import {
    notFound,
} from "next/navigation";

import {
    requireRole,
} from "@/lib/auth/authorization";

import {
    ROLE_IDS,
} from "@/lib/auth/roles";

import {
    getAdviserSubmission,
} from "@/lib/services/adviser-submission.service";

import DownloadSubmissionButton from "../DownloadSubmissionButton";

import StartReviewButton from "../StartReviewButton";

import FeedbackForm from "../FeedbackForm";

/**
 * Displays the details of one research
 * submission belonging to the Adviser.
 */
export default async function AdviserSubmissionDetailsPage({
    params,
}: {
    params: Promise<{
        submissionId: string;
    }>;
}) {
    const session =
        await requireRole([
            ROLE_IDS.ADVISER,
        ]);

    const {
        submissionId,
    } = await params;

    const parsedSubmissionId =
        Number(
            submissionId
        );

    if (
        !Number.isInteger(
            parsedSubmissionId
        ) ||
        parsedSubmissionId <= 0
    ) {
        notFound();
    }

    const result =
        await getAdviserSubmission(
            parsedSubmissionId,
            session.userId
        );

    if (
        !result.success ||
        !result.data
    ) {
        notFound();
    }

    const submission =
        result.data;

    return (
        <main
            style={{
                maxWidth: "900px",
                margin: "0 auto",
                padding: "40px 20px",
            }}
        >
            <p>
                <Link href="/dashboard/adviser/submissions">
                    ← Back to Submissions
                </Link>
            </p>

            <h1>
                Submission Details
            </h1>

            <hr
                style={{
                    margin: "30px 0",
                }}
            />

            <section>
                <h2>
                    Research Information
                </h2>

                <dl>
                    <div
                        style={{
                            marginBottom:
                                "16px",
                        }}
                    >
                        <dt>
                            <strong>
                                Research Title
                            </strong>
                        </dt>

                        <dd>
                            {
                                submission.researchTitle
                            }
                        </dd>
                    </div>

                    <div
                        style={{
                            marginBottom:
                                "16px",
                        }}
                    >
                        <dt>
                            <strong>
                                Research Group
                            </strong>
                        </dt>

                        <dd>
                            {
                                submission.groupName
                            }
                        </dd>
                    </div>

                    <div
                        style={{
                            marginBottom:
                                "16px",
                        }}
                    >
                        <dt>
                            <strong>
                                Student
                            </strong>
                        </dt>

                        <dd>
                            {
                                submission.studentFirstName
                            }{" "}
                            {
                                submission.studentLastName
                            }
                        </dd>
                    </div>
                </dl>
            </section>

            <hr
                style={{
                    margin: "30px 0",
                }}
            />

            <section>
                <h2>
                    Submission Information
                </h2>

                <dl>
                    <div
                        style={{
                            marginBottom:
                                "16px",
                        }}
                    >
                        <dt>
                            <strong>
                                Version
                            </strong>
                        </dt>

                        <dd>
                            {
                                submission.version
                            }
                        </dd>
                    </div>

                    <div
                        style={{
                            marginBottom:
                                "16px",
                        }}
                    >
                        <dt>
                            <strong>
                                Status
                            </strong>
                        </dt>

                        <dd>
                            {submission.status}
                            {(submission.status ===
                                "Under Review" ||
                                submission.status ===
                                    "Submitted") && (
                                <FeedbackForm
                                    submissionId={
                                        submission.id
                                    }
                                />
                            )}
                        </dd>
                    </div>

                    <div
                        style={{
                            marginBottom:
                                "16px",
                        }}
                    >
                        <dt>
                            <strong>
                                Submitted At
                            </strong>
                        </dt>

                        <dd>
                            {submission.submittedAt.toLocaleString()}
                        </dd>
                    </div>

                    <div
                        style={{
                            marginBottom:
                                "16px",
                        }}
                    >
                        <dt>
                            <strong>
                                Student Remarks
                            </strong>
                        </dt>

                        <dd>
                            {
                                submission.remarks ??
                                "No remarks provided."
                            }
                        </dd>
                    </div>
                </dl>
            </section>

            <hr
                style={{
                    margin: "30px 0",
                }}
            />

            <section>
                <h2>
                    Research Document
                </h2>

                <p>
                    Open the submitted research
                    document using a temporary
                    secure download link.
                </p>

                <div>
                    <DownloadSubmissionButton
                        submissionId={submission.id}
                    />

                    {submission.status ===
                        "Submitted" && (
                        <StartReviewButton
                            submissionId={
                                submission.id
                            }
                        />
                    )}
                </div>
                
            </section>
        </main>
    );
}
