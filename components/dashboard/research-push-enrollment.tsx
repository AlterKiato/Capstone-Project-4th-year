"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useDisplayMode } from "@/lib/pwa/use-display-mode";
import { ResearchPushClient, ownResearchPushClient } from "@/lib/pwa/research-push-client";
import { browserPushEnvironment } from "@/lib/pwa/research-push-browser";
import { acceptPushNavigation, PUSH_NAVIGATION_EVENT } from "@/lib/pwa/research-push-navigation";
import styles from "./research-push-enrollment.module.css";

export default function ResearchPushEnrollment({ userId, roleId, expiresAt, configured }: {
    userId: number; roleId: number; expiresAt: number; configured: boolean;
}) {
    const mode = useDisplayMode(), router = useRouter();
    const client = useMemo(() => new ResearchPushClient({ roleId, installed: mode === "standalone", configured, expiresAt },
        browserPushEnvironment(userId)), [userId, roleId, expiresAt, configured, mode]);
    const view = useSyncExternalStore(client.subscribe, client.snapshot, client.serverSnapshot);
    useEffect(() => {
        const release = ownResearchPushClient(client);
        void client.start();
        const refresh = () => { if (document.visibilityState === "visible" && client.snapshot().phase !== "busy") void client.start(); };
        const navigate = (event: MessageEvent) => {
            acceptPushNavigation(event.data, (event.source as ServiceWorker | null)?.scriptURL ?? "", window.location.origin,
                path => router.push(path), path => window.dispatchEvent(new CustomEvent(PUSH_NAVIGATION_EVENT, { cancelable: true, detail: { path } })));
        };
        document.addEventListener("visibilitychange", refresh);
        navigator.serviceWorker?.addEventListener("message", navigate);
        return () => { release(); document.removeEventListener("visibilitychange", refresh); navigator.serviceWorker?.removeEventListener("message", navigate); };
    }, [client, router]);
    if (roleId !== 2 && roleId !== 3) return null;
    return <section className={styles.section} aria-labelledby="research-notifications-heading" aria-busy={view.phase === "busy" || view.phase === "loading"}>
        <h2 id="research-notifications-heading">Research Notifications</h2>
        <p className="form-help">Only one device can receive notifications per account. Enabling another device replaces the previous enrollment.</p>
        <p role="status" aria-live="polite">{view.message}</p>
        <div className={styles.actions}>
            {view.canEnable && <button type="button" onClick={() => { void client.enable(); }}>Enable Notifications</button>}
            {view.canDisable && <button type="button" onClick={() => { void client.disable(); }} disabled={view.phase === "busy"}>Disable Notifications</button>}
            {!["loading", "busy", "install", "unsupported", "expired"].includes(view.phase) &&
                <button type="button" onClick={() => { void client.start(); }}>Refresh status</button>}
        </div>
    </section>;
}
