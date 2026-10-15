"use client";

import { useTheme } from "@/components/theme-provider";
import styles from "./theme-preferences.module.css";

export default function ThemePreferences() {
    const { preference, ready, select } = useTheme();
    return <fieldset className={styles.preferences} disabled={!ready}>
        <legend className="sr-only">Theme preference</legend>
        {(["light", "dark", "system"] as const).map(value => <label key={value}>
            <input type="radio" name="theme-preference" value={value} checked={preference === value} onChange={() => select(value)} />
            <span>{value[0].toUpperCase() + value.slice(1)}</span>
        </label>)}
    </fieldset>;
}
