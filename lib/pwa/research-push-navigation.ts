export const PUSH_NAVIGATION_EVENT = "thesishs:push-navigation";
const destinations = {
    "student-notifications": "/dashboard/student/notifications",
    "adviser-notifications": "/dashboard/adviser/notifications",
} as const;
export function pushDestination(value: unknown): string | null {
    return typeof value === "string" && Object.hasOwn(destinations, value) ? destinations[value as keyof typeof destinations] : null;
}
export function acceptPushNavigation(data: unknown, sourceScript: string, origin: string, navigate: (path: string) => void,
    allowed: (path: string) => boolean): boolean {
    if (sourceScript !== `${origin}/sw.js` || !data || typeof data !== "object") return false;
    const message = data as { type?: unknown; destination?: unknown };
    const path = pushDestination(message.destination);
    if (Object.keys(data).length !== 2 || message.type !== "thesishs-research-push" || !path || !allowed(path)) return false;
    navigate(path); return true;
}
