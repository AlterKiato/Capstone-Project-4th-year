export type WorkspaceTab = "tasks" | "notes";
export function workspaceView(tab: string | string[] | undefined, deleted: string | string[] | undefined) {
    const selected: WorkspaceTab = tab === "notes" ? "notes" : "tasks";
    return { tab: selected, deletedOnly: selected === "notes" && deleted === "1" };
}
export function workspaceHref(projectId: number | null, tab: WorkspaceTab, deletedOnly = false) {
    const params = new URLSearchParams();
    if (projectId !== null) params.set("project", String(projectId));
    params.set("tab", tab);
    if (tab === "notes" && deletedOnly) params.set("deleted", "1");
    return `/dashboard/student/workspace?${params}`;
}
