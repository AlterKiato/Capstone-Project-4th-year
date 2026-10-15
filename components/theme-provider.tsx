"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { effectiveTheme, themePreference, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

const ThemeContext = createContext<{
    preference: ThemePreference;
    ready: boolean;
    select: (preference: ThemePreference) => void;
} | null>(null);

// One browser store, independent of identity. React uses a stable server snapshot
// during hydration; browser APIs are only read by the client snapshot/subscription.
let current: ThemePreference | undefined;
const listeners = new Set<() => void>();

function clientSnapshot(): ThemePreference {
    if (current === undefined) {
        current = "system";
        try { current = themePreference(localStorage.getItem(THEME_STORAGE_KEY)); } catch { /* System fallback. */ }
    }
    return current;
}

function apply() {
    document.documentElement.dataset.theme = effectiveTheme(clientSnapshot(), window.matchMedia("(prefers-color-scheme: dark)").matches);
}

function subscribe(notify: () => void) {
    listeners.add(notify);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function synchronize(event: StorageEvent) {
        if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
        try { if (event.storageArea !== localStorage) return; } catch { return; }
        current = themePreference(event.newValue);
        apply();
        listeners.forEach(listener => listener());
    }
    window.addEventListener("storage", synchronize);
    media.addEventListener("change", apply);
    apply();
    return () => {
        listeners.delete(notify);
        window.removeEventListener("storage", synchronize);
        media.removeEventListener("change", apply);
    };
}

function select(value: ThemePreference) {
    current = value;
    try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch { /* Selection remains usable for this page. */ }
    apply();
    listeners.forEach(listener => listener());
}

const serverSnapshot = () => null;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const preference = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
    return <ThemeContext value={{ preference: preference ?? "system", ready: preference !== null, select }}>{children}</ThemeContext>;
}

export function useTheme() {
    const theme = useContext(ThemeContext);
    if (!theme) throw new Error("Theme controls require ThemeProvider");
    return theme;
}
