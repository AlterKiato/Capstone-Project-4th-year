import "server-only";
import type { GuideRole, GuideTopic, GuideTopicId } from "@/types/chatbot-guide";

type TopicCard = GuideTopic & { roles: readonly GuideRole[] };
const allRoles = [1, 2, 3] as const;
const card = (id: GuideTopicId, question: string, answer: string, roles: readonly GuideRole[], href: string, label: string): TopicCard =>
    ({ id, question, answer, roles, links: [{ href, label }] });

// Reviewed against existing dashboard pages/services; no live research context.
const cards: readonly TopicCard[] = [
    card("student-project", "How do I create a research project?",
        "Your Adviser assigns you to an active research group. A Student can belong to only one active group at a time. Open the Student Dashboard, select your active group and complete the research project form. New projects begin as Draft. Contact your Adviser if you have no active group.",
        [3], "/dashboard/student", "Student Dashboard"),
    card("student-submission", "How do I submit my research document?",
        "Open My Research & Submissions and select your group's research project. Upload a PDF no larger than 10 MiB; remarks are optional. The submission is stored as a numbered version with Submitted status. Your assigned Adviser is notified of a new submission. The guide cannot upload or check your document.",
        [3], "/dashboard/student/submissions", "My Research & Submissions"),
    card("student-revision", "How do revisions and version history work?",
        "Read your Adviser's feedback for the specific submission version in My Research & Submissions. You can submit a new version only when the latest version is Revision Required. Previous submissions and their feedback are preserved. Submitted, Under Review and Approved versions are not eligible for a new submission. Ask your Adviser about academic revisions. Approval and Admin repository publication are separate steps.",
        [3], "/dashboard/student/submissions", "My Research & Submissions"),
    card("adviser-groups", "How do I manage my research groups?",
        "Open Research Groups to create and manage your own groups and manually add or remove Students. Students can be added only to an active group and cannot belong to another active group at the same time. Your group operations are limited to groups you own.",
        [2], "/dashboard/adviser/groups", "Research Groups"),
    card("adviser-review", "How do I start a submission review?",
        "Open Review Submissions and choose a submission from one of your own research groups. Start review is available for Submitted versions and changes the submission status to Under Review. The research project uses the separate status In Review. This guide cannot access documents or start a review.",
        [2], "/dashboard/adviser/submissions", "Review Submissions"),
    card("adviser-feedback", "How do I record feedback and a decision?",
        "Open the submission detail for your own group. The submission must be Under Review before you can enter your own feedback and choose Revision Required or Approved. Feedback belongs to that submission version, and the submitting Student receives a decision notification. The guide cannot generate official feedback, evaluate research or recommend a decision; academic judgment remains yours.",
        [2], "/dashboard/adviser/submissions", "Review Submissions"),
    card("admin-users", "Where do I manage users?",
        "Open User Management to view users, change their roles and activate or deactivate accounts. Use the existing controls as an Admin. The system prevents changes to your own account status or role through these controls. This guide does not retrieve account details or change users.",
        [1], "/dashboard/admin/users", "User Management"),
    card("admin-groups", "Where do I monitor research groups?",
        "Open Manage Groups to monitor research groups across the system. Existing controls let an Admin archive or reactivate groups. Adviser group ownership and Student membership rules continue to apply to research workflows. The guide cannot inspect or modify a group.",
        [1], "/dashboard/admin/groups", "Manage Groups"),
    card("admin-publication", "How do I publish approved research?",
        "Open Repository Management. Research must be Approved and have an approved submission with a valid existing private document before it can be published. Publish eligible research using the existing controls. Repository entries can be published or hidden. Adviser approval does not automatically publish a paper; publication is an Admin operation.",
        [1], "/dashboard/admin/repository", "Repository Management"),
    card("admin-reports", "What information is in Admin Reports?",
        "Reports provides read-only user counts by role, total research groups, research paper counts by status, eligible published paper counts and the latest five recorded activity actions with timestamps. Counts are separate live reads, not a historical snapshot. Charts, exports and date-range analytics are not available.",
        [1], "/dashboard/admin/reports", "Reports"),
    card("repository", "How do I browse the research repository?",
        "Open Browse Repository to find Adviser-approved research published by an Admin. Search title, abstract or keywords and filter by category, school year or strand. Results use newest-first ordering with 10 papers per page. Clear filters resets your search. Open a listed paper for its detail and the existing View PDF or download controls. Repository access requires authentication; this guide does not retrieve papers or documents.",
        allRoles, "/dashboard/repository", "Browse Repository"),
    card("human-help", "What can this guide help with?",
        "This guide explains existing ThesiSHS AI navigation and workflows only. It cannot grade research, approve or reject submissions, generate official Adviser feedback, summarize documents or replace human academic judgment. Consult your Adviser for academic questions and your Admin for account or access problems. Choose a predefined question; private research and personal data are not needed.",
        allRoles, "/dashboard", "Dashboard"),
];

export function getRoleGuideTopics(role: GuideRole): GuideTopic[] {
    const rolePath = role === 1 ? "admin" : role === 2 ? "adviser" : "student";
    const notifications: GuideTopic = {
        id: "notifications",
        question: "Where do I read and manage my notifications?",
        answer: "Open your role's Notifications page to view your own notifications. You can mark them as read or delete them. Students receive Adviser decision notifications; Advisers receive new-submission notifications. The guide cannot read or manage notifications and does not promise email delivery.",
        links: [{ href: `/dashboard/${rolePath}/notifications`, label: "Notifications" }],
    };
    return [...cards.filter(topic => topic.roles.includes(role)).map(({ id, question, answer, links }) =>
        ({ id, question, answer, links })), notifications];
}
