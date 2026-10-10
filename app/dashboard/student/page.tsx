import {
    requireRole,
} from "@/lib/auth/authorization";

import {
    ROLE_IDS,
} from "@/lib/auth/roles";

import {
    getStudentResearchGroups,
} from "@/lib/services/student-research.service";

import {
    createStudentResearchAction,
} from "@/lib/actions/student-research.action";
import DashboardNavigation from "@/components/dashboard/dashboard-navigation";
import DashboardHeader from "@/components/dashboard/dashboard-header";

/**
 * Student dashboard and research
 * project creation page.
 */
export default async function StudentPage() {
    const session =
        await requireRole([
            ROLE_IDS.STUDENT,
        ]);

    const groupsResult =
        await getStudentResearchGroups(
            session.userId
        );

    const groups =
        groupsResult.data ?? [];

    return (
        <main className="dashboard-page">
            <DashboardHeader title="Student Dashboard" email={session.email} />

            <DashboardNavigation links={[
                { href: "/dashboard/student", label: "Overview" },
                { href: "/dashboard/student/submissions", label: "My Research & Submissions" },
                { href: "/dashboard/student/notifications", label: "Notifications" },
                { href: "/dashboard/repository", label: "Browse Repository" },
            ]} />

            <section className="dashboard-panel">
                <h2>
                    Create Research Project
                </h2>

                <p>
                    Create your research project
                    after your title proposal has
                    been accepted.
                </p>

                {groups.length === 0 ? (
                    <p>
                        You are not currently
                        assigned to an active research
                        group. Please contact your
                        Adviser.
                    </p>
                ) : (
                    <form
                        action={
                            createStudentResearchAction
                        }
                        className="dashboard-form"
                    >
                        <div>
                            <label
                                htmlFor="groupId"
                            >
                                Research Group
                            </label>

                            <br />

                            <select
                                id="groupId"
                                name="groupId"
                                required
                                defaultValue=""
                            >
                                <option
                                    value=""
                                    disabled
                                >
                                    Select your
                                    research group
                                </option>

                                {groups.map(
                                    (group) => (
                                        <option
                                            key={
                                                group.id
                                            }
                                            value={
                                                group.id
                                            }
                                        >
                                            {
                                                group.groupName
                                            }{" "}
                                            —{" "}
                                            {
                                                group.strand
                                            }{" "}
                                            {
                                                group.section
                                            }{" "}
                                            (
                                            {
                                                group.schoolYear
                                            }
                                            )
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        <div>
                            <label
                                htmlFor="title"
                            >
                                Research Title
                            </label>

                            <br />

                            <input
                                id="title"
                                name="title"
                                type="text"
                                maxLength={200}
                                required
                                placeholder="Enter your accepted research title"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="abstract"
                            >
                                Abstract
                            </label>

                            <br />

                            <textarea
                                id="abstract"
                                name="abstract"
                                rows={8}
                                required
                                placeholder="Enter the research abstract"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="category"
                            >
                                Category
                            </label>

                            <br />

                            <input
                                id="category"
                                name="category"
                                type="text"
                                maxLength={100}
                                placeholder="Example: STEM, Business, Humanities"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="keywords"
                            >
                                Keywords
                            </label>

                            <br />

                            <input
                                id="keywords"
                                name="keywords"
                                type="text"
                                maxLength={500}
                                placeholder="Enter keywords separated by commas"
                            />
                        </div>

                        <button
                            type="submit"
                        >
                            Create Research Project
                        </button>
                    </form>
                )}
            </section>
        </main>
    );
}
