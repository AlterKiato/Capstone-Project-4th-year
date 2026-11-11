import { TASK_STATUSES } from "./workspace/task-board-view";

export function workspaceTaskCounts(tasks: { status: string }[]) {
    return Object.fromEntries(TASK_STATUSES.map(status => [status, tasks.filter(task => task.status === status).length])) as Record<typeof TASK_STATUSES[number], number>;
}

export type ResearchTab = "history" | "progress" | "revisions";
export function researchTabFromHash(hash: string): ResearchTab {
    return hash === "#research-progress" ? "progress" : hash === "#revision-checklist" ? "revisions" : "history";
}

export function helpPopoverPosition(trigger: { top: number; bottom: number; right: number }, size: { width: number; height: number }, viewport: { left: number; top: number; width: number; height: number }) {
    const gap = 8, edge = 12;
    const left = Math.max(viewport.left + edge, Math.min(trigger.right - size.width, viewport.left + viewport.width - size.width - edge));
    const above = trigger.top - size.height - gap;
    const preferred = above >= viewport.top + edge ? above : trigger.bottom + gap;
    const top = Math.max(viewport.top + edge, Math.min(preferred, viewport.top + viewport.height - size.height - edge));
    return { left, top };
}
