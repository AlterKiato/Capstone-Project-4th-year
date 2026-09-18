import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

import {
    getResearchGroupsByAdviser,
} from "@/lib/services/research-group.services";

import {
    getGroupMembers,
} from "@/lib/services/group-member.services";

import {
    findUsersByRoleId,
} from "@/lib/repositories/user.repository";

import {
    createResearchGroupAction,
} from "@/lib/actions/research-group.action";

import {
    findGroupsByUserId,
} from "@/lib/repositories/group-member.repository";

import {
    addGroupMemberAction,
    removeGroupMemberAction,
} from "@/lib/actions/group-member.action";

/**
 * Adviser Research Group Management page.
 *
 * Displays only the research groups belonging
 * to the currently authenticated Adviser.
 *
 * Advisers can create groups and manage
 * the Students belonging to their groups.
 */
export default async function AdviserGroupsPage() {
    // Ensure that only Adviser users can access this page.
    const session = await requireRole([
        ROLE_IDS.ADVISER,
    ]);

    // Retrieve only the research groups owned
    // by the currently logged-in Adviser.
    const result =
        await getResearchGroupsByAdviser(
            session.userId
        );

    // Handle unexpected service failures.
    if (
        !result.success ||
        !result.data
    ) {
        return (
            <main>
                <h1>
                    My Research Groups
                </h1>

                <p>
                    {result.message}
                </p>
            </main>
        );
    }

    const groups = result.data;

    // Retrieve all Student accounts that can
    // potentially be assigned to a research group.
    const students =
        await findUsersByRoleId(
            ROLE_IDS.STUDENT
        );

    /*
     * Determine which Students already belong
     * to an active research group.
     *
     * This is used only to improve the UI.
     * The server-side service still performs
     * the actual security/business-rule check.
     */
    const studentActiveGroups =
        await Promise.all(
            students.map(
                async (student) => {
                    const studentGroups =
                        await findGroupsByUserId(
                            student.id
                        );

                    const activeGroup =
                        studentGroups.find(
                            (group) =>
                                group.status ===
                                "active"
                        );

                    return {
                        studentId:
                            student.id,
                        activeGroupId:
                            activeGroup?.id ??
                            null,
                    };
                }
            )
        );

    return (
        <main>
            <h1>
                My Research Groups
            </h1>

            <p>
                Create and manage your research
                groups.
            </p>

            {/* Research Group Creation Form */}
            <section>
                <h2>
                    Create Research Group
                </h2>

                <form
                    action={
                        createResearchGroupAction
                    }
                >
                    <div>
                        <label htmlFor="groupName">
                            Group Name
                        </label>

                        <input
                            id="groupName"
                            name="groupName"
                            type="text"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="strand">
                            Strand
                        </label>

                        <input
                            id="strand"
                            name="strand"
                            type="text"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="section">
                            Section
                        </label>

                        <input
                            id="section"
                            name="section"
                            type="text"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="schoolYear">
                            School Year
                        </label>

                        <input
                            id="schoolYear"
                            name="schoolYear"
                            type="text"
                            required
                        />
                    </div>

                    <button type="submit">
                        Create Research Group
                    </button>
                </form>
            </section>

            {/* Adviser Research Groups */}
            <section>
                <h2>
                    My Groups
                </h2>

                {groups.length === 0 ? (
                    <p>
                        You have not created any
                        research groups yet.
                    </p>
                ) : (
                    <div>
                        {groups.map(
                            async (group) => {
                                // Retrieve the members of this
                                // specific research group.
                                const membersResult =
                                    await getGroupMembers(
                                        group.id
                                    );

                                const members =
                                    membersResult.data ??
                                    [];

                                // Create a lookup set for
                                // Students already assigned
                                // to this specific group.
                                const memberUserIds =
                                    new Set(
                                        members.map(
                                            (member) =>
                                                member.userId
                                        )
                                    );

                                /*
                                 * Only Students who:
                                 *
                                 * 1. Are not already members
                                 *    of this group.
                                 *
                                 * 2. Do not belong to another
                                 *    active research group.
                                 *
                                 * can appear in Add Student.
                                 */
                                const availableStudents =
                                    students.filter(
                                        (student) => {
                                            const activeGroup =
                                                studentActiveGroups.find(
                                                    (
                                                        assignment
                                                    ) =>
                                                        assignment.studentId ===
                                                        student.id
                                                );

                                            /*
                                             * Student is already
                                             * in this group.
                                             */
                                            if (
                                                memberUserIds.has(
                                                    student.id
                                                )
                                            ) {
                                                return false;
                                            }

                                            /*
                                             * Student is already
                                             * in another active group.
                                             */
                                            if (
                                                activeGroup &&
                                                activeGroup.activeGroupId !==
                                                    null &&
                                                activeGroup.activeGroupId !==
                                                    group.id
                                            ) {
                                                return false;
                                            }

                                            return true;
                                        }
                                    );

                                return (
                                    <article
                                        key={
                                            group.id
                                        }
                                        style={{
                                            marginBottom:
                                                "30px",
                                            padding:
                                                "20px",
                                            border:
                                                "1px solid #ccc",
                                        }}
                                    >
                                        <h3>
                                            {
                                                group.groupName
                                            }
                                        </h3>

                                        <p>
                                            <strong>
                                                Strand:
                                            </strong>{" "}
                                            {
                                                group.strand
                                            }
                                        </p>

                                        <p>
                                            <strong>
                                                Section:
                                            </strong>{" "}
                                            {
                                                group.section
                                            }
                                        </p>

                                        <p>
                                            <strong>
                                                School Year:
                                            </strong>{" "}
                                            {
                                                group.schoolYear
                                            }
                                        </p>

                                        <p>
                                            <strong>
                                                Status:
                                            </strong>{" "}
                                            {
                                                group.status
                                            }
                                        </p>

                                        {/* Current Group Members */}
                                        <section>
                                            <h4>
                                                Members
                                            </h4>

                                            {members.length ===
                                            0 ? (
                                                <p>
                                                    No Students are
                                                    currently
                                                    assigned to this
                                                    group.
                                                </p>
                                            ) : (
                                                <ul>
                                                    {members.map(
                                                        (
                                                            member
                                                        ) => {
                                                            const student =
                                                                students.find(
                                                                    (
                                                                        user
                                                                    ) =>
                                                                        user.id ===
                                                                        member.userId
                                                                );

                                                            return (
                                                                <li
                                                                    key={
                                                                        member.id
                                                                    }
                                                                    style={{
                                                                        marginBottom:
                                                                            "10px",
                                                                    }}
                                                                >
                                                                    {student ? (
                                                                        <>
                                                                            <strong>
                                                                                {
                                                                                    student.firstName
                                                                                }{" "}
                                                                                {
                                                                                    student.lastName
                                                                                }
                                                                            </strong>{" "}
                                                                            —{" "}
                                                                            {
                                                                                student.email
                                                                            }

                                                                            <form
                                                                                action={removeGroupMemberAction.bind(
                                                                                    null,
                                                                                    group.id,
                                                                                    member.userId
                                                                                )}
                                                                                style={{
                                                                                    display:
                                                                                        "inline",
                                                                                    marginLeft:
                                                                                        "10px",
                                                                                }}
                                                                            >
                                                                                <button
                                                                                    type="submit"
                                                                                >
                                                                                    Remove
                                                                                </button>
                                                                            </form>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            Student ID:{" "}
                                                                            {
                                                                                member.userId
                                                                            }

                                                                            <form
                                                                                action={removeGroupMemberAction.bind(
                                                                                    null,
                                                                                    group.id,
                                                                                    member.userId
                                                                                )}
                                                                                style={{
                                                                                    display:
                                                                                        "inline",
                                                                                    marginLeft:
                                                                                        "10px",
                                                                                }}
                                                                            >
                                                                                <button
                                                                                    type="submit"
                                                                                >
                                                                                    Remove
                                                                                </button>
                                                                            </form>
                                                                        </>
                                                                    )}
                                                                </li>
                                                            );
                                                        }
                                                    )}
                                                </ul>
                                            )}
                                        </section>

                                        {/* Add Student */}
                                        <section
                                            style={{
                                                marginTop:
                                                    "20px",
                                            }}
                                        >
                                            <h4>
                                                Add Student
                                            </h4>

                                            {availableStudents.length ===
                                            0 ? (
                                                <p>
                                                    There are no
                                                    available Students
                                                    to add to this
                                                    group.
                                                </p>
                                            ) : (
                                                <ul>
                                                    {availableStudents.map(
                                                        (
                                                            student
                                                        ) => (
                                                            <li
                                                                key={
                                                                    student.id
                                                                }
                                                                style={{
                                                                    marginBottom:
                                                                        "10px",
                                                                }}
                                                            >
                                                                <strong>
                                                                    {
                                                                        student.firstName
                                                                    }{" "}
                                                                    {
                                                                        student.lastName
                                                                    }
                                                                </strong>{" "}
                                                                —{" "}
                                                                {
                                                                    student.email
                                                                }

                                                                <form
                                                                    action={addGroupMemberAction.bind(
                                                                        null,
                                                                        group.id,
                                                                        student.id
                                                                    )}
                                                                    style={{
                                                                        display:
                                                                            "inline",
                                                                        marginLeft:
                                                                            "10px",
                                                                    }}
                                                                >
                                                                    <button
                                                                        type="submit"
                                                                    >
                                                                        Add
                                                                    </button>
                                                                </form>
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            )}
                                        </section>
                                    </article>
                                );
                            }
                        )}
                    </div>
                )}
            </section>
        </main>
    );
}