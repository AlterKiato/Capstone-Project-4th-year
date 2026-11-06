"use client";

import { useDisplayMode, usePwaPlatform } from "@/lib/pwa/use-display-mode";
import { selectSidebarMode, useSidebarPreference, type SidebarMode } from "@/lib/pwa/navigation-preferences";
import styles from "./sidebar-preferences.module.css";

export default function SidebarPreferences() {
    const displayMode = useDisplayMode();
    const platform = usePwaPlatform();
    const profile = displayMode === "standalone" && platform === "desktop" ? "desktop" : "browser";
    const mode = useSidebarPreference(profile);
    // Unknown SSR/installed hints wait for detection. Mobile apps have no desktop preference UI.
    if (displayMode === "unknown" || displayMode === "standalone" && platform !== "desktop") return null;

    return <section className="dashboard-panel" aria-labelledby="sidebar-preferences-heading">
        <h2 id="sidebar-preferences-heading">Navigation</h2>
        <p id="sidebar-preferences-help" className="form-help">Applies to wide windows (1024px and wider). Narrow windows use the navigation menu.</p>
        <div className={styles.control}>
            <label htmlFor="sidebar-mode-preference">Sidebar mode</label>
            <select id="sidebar-mode-preference" value={mode} aria-describedby="sidebar-preferences-help" onChange={event => selectSidebarMode(profile, event.target.value as SidebarMode)}>
                <option value="expanded">Expanded</option>
                <option value="compact">Compact</option>
                {profile === "desktop" ? <option value="hidden">Hidden</option> : null}
            </select>
        </div>
    </section>;
}
