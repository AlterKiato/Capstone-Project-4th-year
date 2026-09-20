import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

import {
    getStudentResearchProjects,
} from "@/lib/services/student-research.service";

import {
    getSubmissionsByStudent,
} from "@/lib/services/submission.service";

import {
    getStudentFeedbackBySubmission,
} from "@/lib/services/student-feedback.service";

import {
    submitResearchAction,
} from "@/lib/actions/submission.action";

import DownloadSubmissionButton from "./DownloadSubmissionButton";

/**
 * Student research submission page.
 *
 * Displays the Student's research projects,
 * allows a project to be selected for submission,
 * displays previous submission versions,
 * and displays Adviser feedback for each
 * student's own submission.
 */
export default async function StudentSubmissionsPage() {
    const session =
        await requireRole([
            ROLE_IDS.STUDENT,
        ]);

    const projectsResult =
        await getStudentResearchProjects(
            session.userId
        );

    const projects =
        projectsResult.data ?? [];

    const submissionsResult =
        await getSubmissionsByStudent(
            session.userId
        );

    const submissions =
        submissionsResult.data ?? [];

    /**
     * Retrieve feedback for every submission.
     *
     * The Student feedback service performs
     * the authorization check for each submission.
     */
    const submissionsWithFeedback =
        await Promise.all(
            submissions.map(
                async (submission) => {
                    const feedbackResult =
                        await getStudentFeedbackBySubmission(
                            submission.id,
                            session.userId
                        );

                    return {
                        submission,
                        feedback:
                            feedbackResult.success
                                ? feedbackResult.data ?? []
                                : [],
                    };
                }
            )
        );

    return (
        <main
            style={{
                maxWidth: "1000px",
                margin: "0 auto",
                padding: "40px 20px",
            }}
        >
            <h1>
                Research Submissions
            </h1>

            <p>
                Submit your research document
                and track your submission versions.
            </p>

            <hr
                style={{
                    margin: "30px 0",
                }}
            />

            <section>
                <h2>
                    Submit Research
                </h2>

                {projects.length === 0 ? (
                    <p>
                        You do not have any research
                        projects available for submission.
                        Please create a research project
                        first or contact your Adviser.
                    </p>
                ) : (
                    <form
                        action={
                            submitResearchAction
                        }
                        style={{
                            display: "flex",
                            flexDirection:
                                "column",
                            gap: "16px",
                            marginTop: "20px",
                        }}
                    >
                        <div>
                            <label htmlFor="paperId">
                                Research Project
                            </label>

                            <br />

                            <select
                                id="paperId"
                                name="paperId"
                                required
                                defaultValue=""
                            >
                                <option
                                    value=""
                                    disabled
                                >
                                    Select a research
                                    project
                                </option>

                                {projects.map(
                                    (project) => (
                                        <option
                                            key={
                                                project.id
                                            }
                                            value={
                                                project.id
                                            }
                                        >
                                            {project.title}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="file">
                                Research Document
                            </label>

                            <br />

                            <input
                                id="file"
                                name="file"
                                type="file"
                                accept="application/pdf,.pdf"
                                required
                            />

                            <p>
                                PDF files only.
                                Maximum file size:
                                10 MB.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="remarks">
                                Remarks
                            </label>

                            <br />

                            <textarea
                                id="remarks"
                                name="remarks"
                                rows={5}
                                maxLength={500}
                                placeholder="Optional remarks for your Adviser"
                            />
                        </div>

                        <button
                            type="submit"
                        >
                            Submit Research
                        </button>
                    </form>
                )}
            </section>

            <hr
                style={{
                    margin: "40px 0",
                }}
            />

            <section>
                <h2>
                    Submission History
                </h2>

                {submissions.length === 0 ? (
                    <p>
                        You have not submitted any
                        research documents yet.
                    </p>
                ) : (
                    <table
                        style={{
                            width: "100%",
                            borderCollapse:
                                "collapse",
                            marginTop: "20px",
                        }}
                    >
                        <thead>
                            <tr>
                                <th>ID</th>

                                <th>
                                    Research ID
                                </th>

                                <th>
                                    Version
                                </th>

                                <th>
                                    File
                                </th>

                                <th>
                                    Remarks
                                </th>

                                <th>
                                    Status
                                </th>

                                <th>
                                    Submitted At
                                </th>

                                <th>
                                    Feedback
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {submissionsWithFeedback.map(
                                ({
                                    submission,
                                    feedback,
                                }) => (
                                    <tr
                                        key={
                                            submission.id
                                        }
                                    >
                                        <td>
                                            {
                                                submission.id
                                            }
                                        </td>

                                        <td>
                                            {
                                                submission.paperId
                                            }
                                        </td>

                                        <td>
                                            {
                                                submission.version
                                            }
                                        </td>

                                        <td>
                                            <DownloadSubmissionButton
                                                submissionId={
                                                    submission.id
                                                }
                                            />
                                        </td>

                                        <td>
                                            {
                                                submission.remarks ??
                                                "—"
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
                                            {feedback.length ===
                                            0 ? (
                                                "No feedback yet."
                                            ) : (
                                                <div
                                                    style={{
                                                        display:
                                                            "flex",
                                                        flexDirection:
                                                            "column",
                                                        gap: "12px",
                                                    }}
                                                >
                                                    {feedback.map(
                                                        (
                                                            item
                                                        ) => (
                                                            <div
                                                                key={
                                                                    item.id
                                                                }
                                                                style={{
                                                                    border:
                                                                        "1px solid #ccc",
                                                                    padding:
                                                                        "12px",
                                                                }}
                                                            >
                                                                <p>
                                                                    <strong>
                                                                        Decision:
                                                                    </strong>{" "}
                                                                    {
                                                                        item.decision
                                                                    }
                                                                </p>

                                                                <p>
                                                                    <strong>
                                                                        Comments:
                                                                    </strong>
                                                                </p>

                                                                <p>
                                                                    {
                                                                        item.comments
                                                                    }
                                                                </p>

                                                                <p>
                                                                    <strong>
                                                                        Reviewed:
                                                                    </strong>{" "}
                                                                    {item.createdAt.toLocaleString()}
                                                                </p>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                )}
            </section>
        </main>
    );
}