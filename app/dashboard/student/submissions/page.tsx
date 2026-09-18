import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

import {
    getStudentResearchProjects,
} from "@/lib/services/student-research.service";

import {
    getSubmissionsByStudent,
} from "@/lib/services/submission.service";

import {
    submitResearchAction,
} from "@/lib/actions/submission.action";

/**
 * Student research submission page.
 *
 * Displays the Student's research projects,
 * allows a project to be selected for submission,
 * and displays previous submission versions.
 */
export default async function StudentSubmissionsPage() {
    // Ensure that only authenticated Students
    // can access this page.
    const session = await requireRole([
        ROLE_IDS.STUDENT,
    ]);

    // Retrieve research projects belonging
    // to the Student's research group.
    const projectsResult =
        await getStudentResearchProjects(
            session.userId
        );

    const projects =
        projectsResult.data ?? [];

    // Retrieve the Student's previous submissions.
    const submissionsResult =
        await getSubmissionsByStudent(
            session.userId
        );

    const submissions =
        submissionsResult.data ?? [];

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
                Submit your research document and
                track your submission versions.
            </p>

            <hr
                style={{
                    margin: "30px 0",
                }}
            />

            {/* New research submission section */}
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
                            flexDirection: "column",
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
                            <label htmlFor="fileUrl">
                                Submission File
                            </label>
                            <br />

                            <input
                                id="fileUrl"
                                name="fileUrl"
                                type="text"
                                maxLength={500}
                                required
                                placeholder="Enter temporary file reference"
                            />

                            <p>
                                Firebase Storage will
                                replace this temporary
                                file reference in a
                                later step.
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

            {/* Previous submissions section */}
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
                                <th>
                                    ID
                                </th>

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
                            </tr>
                        </thead>

                        <tbody>
                            {submissions.map(
                                (submission) => (
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
                                            {
                                                submission.fileUrl
                                            }
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