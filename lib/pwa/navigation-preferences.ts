"use client";

import { useSyncExternalStore } from "react";
import type { DisplayMode } from "./display-mode";
import type { PwaPlatform } from "./platform";

export type SidebarMode = "expanded" | "compact" | "hidden";
export type NavigationProfile = "browser" | "desktop" | "mobile";
export type PreferenceProfile = "browser" | "desktop";
export const NAVIGATION_STORAGE_KEYS = {
    browser: "thesishs-navigation-v1-browser",
    desktop: "thesishs-navigation-v1-desktop",
} as const;

export function sidebarPreference(value: string | null, profile: PreferenceProfile): SidebarMode {
    if (value === "expanded" || value === "compact" || value === "hidden" && profile === "desktop") return value;
    return profile === "desktop" ? "compact" : "expanded";
}

export function navigationProfile(mode: DisplayMode, platform: PwaPlatform, hasMobileDestinations: boolean): NavigationProfile {
    if (mode !== "standalone") return "browser";
    if (platform === "desktop") return "desktop";
    if (hasMobileDestinations && (platform === "android" || platform === "ios")) return "mobile";
    return "browser";
}

// Browser-only presentation preferences, independent of accounts and research.
// No viewport fallback or transient Sheet state is written to storage.
const current: Partial<Record<PreferenceProfile, SidebarMode>> = {};
const listeners = new Set<() => void>();
function snapshot(profile: PreferenceProfile) {
    if (current[profile] === undefined) {
        let value: string | null = null;
        try { value = localStorage.getItem(NAVIGATION_STORAGE_KEYS[profile]); } catch { /* Safe default; session selection still works. */ }
        current[profile] = sidebarPreference(value, profile);
    }
    return current[profile];
}
function synchronize(event: StorageEvent) {
    try { if (event.storageArea !== localStorage) return; } catch { return; }
    for (const profile of ["browser", "desktop"] as const) {
        if (event.key === NAVIGATION_STORAGE_KEYS[profile] || event.key === null) {
            current[profile] = sidebarPreference(event.key === null ? null : event.newValue, profile);
        }
    }
    listeners.forEach(listener => listener());
}
function subscribe(notify: () => void) {
    if (listeners.size === 0) window.addEventListener("storage", synchronize);
    listeners.add(notify);
    return () => {
        listeners.delete(notify);
        if (listeners.size === 0) window.removeEventListener("storage", synchronize);
    };
}
export function selectSidebarMode(profile: PreferenceProfile, mode: SidebarMode) {
    const value = sidebarPreference(mode, profile);
    current[profile] = value;
    try { localStorage.setItem(NAVIGATION_STORAGE_KEYS[profile], value); } catch { /* In-memory preference remains usable. */ }
    listeners.forEach(listener => listener());
}
const browserSnapshot = () => snapshot("browser");
const desktopSnapshot = () => snapshot("desktop");
const serverSnapshot = () => null;
export function useSidebarPreference(profile: PreferenceProfile) {
    const value = useSyncExternalStore(subscribe, profile === "desktop" ? desktopSnapshot : browserSnapshot, serverSnapshot);
    return value ?? sidebarPreference(null, profile);
}
