"use client";

import { useDisplayMode, usePwaPlatform } from "@/lib/pwa/use-display-mode";

export default function AppInstallation() {
    const mode = useDisplayMode(), platform = usePwaPlatform();
    return <section className="dashboard-panel installation-help" aria-labelledby="app-installation-heading">
        <h2 id="app-installation-heading">App Installation</h2>
        {mode === "unknown" ? <p role="status">Checking how this app is running…</p> : mode === "standalone" ? <>
            <p>Running in installed app mode.</p>
            <p className="form-help">Research work requires an internet connection. Your account access and permissions are the same as in the browser.</p>
        </> : <>
            <p>You are using ThesiSHS AI in a browser. Installation is optional and opens it as a separate app. An internet connection is still required.</p>
            <details>
                <summary>Installation instructions</summary>
                {platform === "ios" ? <p>In Safari, open Share, then Add to Home Screen. If Open as Web App is shown, turn it on, then tap Add.</p> :
                    platform === "android" ? <p>In Chrome, open the browser menu and look for Install, Install and create shortcut, or Add to Home screen.</p> :
                        platform === "desktop" ? <p>In Chrome or Edge, use the install control in the address bar or the browser menu when available.</p> :
                            <p>Look in your browser menu for Install app or Add to Home Screen, if available.</p>}
                <p className="form-help">Menu names and installation support vary by browser. If no install option appears, continue using your browser.</p>
            </details>
        </>}
    </section>;
}
