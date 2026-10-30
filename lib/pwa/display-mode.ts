export type DisplayMode = "unknown" | "browser" | "standalone";

const STANDALONE_QUERY = "(display-mode: standalone)";

function standaloneQuery(): MediaQueryList | null {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
    try {
        return window.matchMedia(STANDALONE_QUERY);
    } catch {
        return null;
    }
}

// Presentation only: neither signal proves installation or grants access.
export function getDisplayMode(): DisplayMode {
    if (typeof window === "undefined") return "unknown";
    const navigator = window.navigator as Navigator & { standalone?: boolean };
    return standaloneQuery()?.matches || navigator?.standalone === true ? "standalone" : "browser";
}

export function getServerDisplayMode(): DisplayMode {
    return "unknown";
}

export function subscribeDisplayMode(notify: () => void): () => void {
    const query = standaloneQuery();
    if (typeof query?.addEventListener === "function" && typeof query.removeEventListener === "function") {
        query.addEventListener("change", notify);
        return () => query.removeEventListener("change", notify);
    }
    // Older WebKit exposes only this deprecated pair. Prefer change events above.
    if (typeof query?.addListener === "function" && typeof query.removeListener === "function") {
        query.addListener(notify);
        return () => query.removeListener(notify);
    }
    return () => {};
}
