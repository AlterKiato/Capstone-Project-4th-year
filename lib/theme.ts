export const THEME_STORAGE_KEY = "thesishs-theme";
export type ThemePreference = "light" | "dark" | "system";

export function themePreference(value: string | null): ThemePreference {
    return value === "light" || value === "dark" ? value : "system";
}

export function effectiveTheme(preference: ThemePreference, systemDark: boolean) {
    return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

// Runs during HTML parsing, before content paint. Only a validated preference is read.
export const THEME_INITIALIZATION = `(${function () {
    let preference = "system";
    try {
        const stored = localStorage.getItem("thesishs-theme");
        if (stored === "light" || stored === "dark") preference = stored;
    } catch { /* Storage may be blocked; System still works. */ }
    document.documentElement.dataset.theme = preference === "system"
        ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : preference;
}.toString()})();`;
