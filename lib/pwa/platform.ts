export type PwaPlatform = "unknown" | "android" | "ios" | "desktop";

/** Best-effort presentation hint only. Never use this for account/resource authorization. */
export function detectPwaPlatform(source: { userAgent: string; maxTouchPoints?: number }): PwaPlatform {
    if (/Android/i.test(source.userAgent)) return "android";
    if (/iPhone|iPad|iPod/i.test(source.userAgent) || /Macintosh/i.test(source.userAgent) && (source.maxTouchPoints ?? 0) > 1) return "ios";
    if (/Windows NT|Macintosh|X11|Linux/i.test(source.userAgent)) return "desktop";
    return "unknown";
}

export function getPwaPlatform(): PwaPlatform {
    return typeof navigator === "undefined" ? "unknown" : detectPwaPlatform(navigator);
}
export function getServerPwaPlatform(): PwaPlatform { return "unknown"; }
export function subscribePwaPlatform(): () => void { return () => {}; }
export function isMobilePwaPlatform(platform: PwaPlatform) { return platform === "android" || platform === "ios"; }
