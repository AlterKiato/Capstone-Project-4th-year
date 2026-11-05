export const TASK_STATUSES = ["To Do", "In Progress", "Done"] as const;
export type TaskProject = { id: number; title: string };

// The caller supplies only the already-authorized, deterministically ordered directory.
export function selectTaskProject(projects: TaskProject[], raw: string | string[] | undefined) {
    if (raw === undefined) return { project: projects[0] ?? null, invalid: false };
    if (typeof raw !== "string" || !/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > 2147483647)
        return { project: null, invalid: true };
    const project = projects.find(item => item.id === Number(raw)) ?? null;
    return { project, invalid: project === null };
}

export function taskDueDate(value: string | null) {
    return value ? new Date(`${value}T00:00:00Z`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "No due date";
}
