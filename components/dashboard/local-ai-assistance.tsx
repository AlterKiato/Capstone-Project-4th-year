"use client";

import { useEffect, useState, useTransition } from "react";
import { ConsentDialog } from "@/components/dashboard/ai-governance-dialogs";
import { getLocalAdminAssistanceAction, getLocalAdviserAssistanceAction } from "@/lib/actions/ai-foundation.action";
import { getAdminInterpretationAction, getAdminInterpretationAvailabilityAction } from "@/lib/actions/admin-ai-report.action";
import type { AdminAIResult } from "@/types/ai-foundation";

const adviserQuestions = [
    ["adviser-workflow-overview-v1", "Explain submission workflow counts"],
    ["adviser-start-review-v1", "How do I start review?"],
    ["adviser-record-decision-v1", "How do I record my decision?"],
    ["adviser-revision-history-v1", "How does revision history work?"],
] as const;
const metricLabels: Record<string, string> = {
    totalUsers: "Accounts", totalGroups: "Research groups",
    totalResearchPapers: "Research papers", totalPublishedPapers: "Published papers",
};

export default function LocalAIAssistance({ feature }: { feature: "admin" | "adviser" }) {
    const [result, setResult] = useState<AdminAIResult | null>(null);
    const [liveAvailable, setLiveAvailable] = useState(false);
    const [loadingLive, setLoadingLive] = useState(false);
    const [pending, startTransition] = useTransition();
    useEffect(() => {
        if (feature !== "admin") return;
        let current = true;
        getAdminInterpretationAvailabilityAction().then(value => { if (current) setLiveAvailable(value.available); })
            .catch(() => { if (current) setLiveAvailable(false); });
        return () => { current = false; };
    }, [feature]);
    function consentChanged() {
        setResult(null);
        setLiveAvailable(false);
        getAdminInterpretationAvailabilityAction().then(value => setLiveAvailable(value.available)).catch(() => setLiveAvailable(false));
    }
    function interpretLive() {
        setResult(null);
        setLoadingLive(true);
        startTransition(async () => {
            try { setResult(await getAdminInterpretationAction({ reportId: "admin-overview-v1" })); }
            catch { setResult({ success: false, mode: "unavailable", message: "Live AI could not complete the request. Verified static guidance remains available." }); }
            finally { setLoadingLive(false); }
        });
    }
    function select(id: string) {
        setResult(null);
        setLoadingLive(false);
        startTransition(async () => {
            try {
                setResult(feature === "admin"
                    ? await getLocalAdminAssistanceAction({ reportId: "admin-overview-v1" })
                    : await getLocalAdviserAssistanceAction({ topicId: id }));
            } catch {
                setResult({ success: false, mode: "unavailable", message: "Local assistance is unavailable. Please try again later." });
            }
        });
    }
    return (
        <section aria-label={feature === "admin" ? "Admin report assistance" : "Adviser workflow assistance"} className="dashboard-panel assistance-panel">
            <h2>{feature === "admin" ? "Admin report assistance" : "Adviser workflow assistance"}</h2>
            <ConsentDialog onChange={feature === "admin" ? consentChanged : undefined} />
            <p>{feature === "admin" ? (liveAvailable ? "Live AI is available for approved count-band interpretation." : "Live AI is unavailable.") : "AI interpretation is disabled."} Choose a predefined question for verified static guidance.</p>
            <div className="surface-actions">
                {feature === "admin" ? <button type="button" disabled={pending} onClick={() => select("admin-overview-v1")}>Explain report metrics</button>
                    : adviserQuestions.map(([id, label]) => <button key={id} type="button" disabled={pending} onClick={() => select(id)}>{label}</button>)}
                {feature === "admin" && <button type="button" disabled={pending || !liveAvailable} onClick={interpretLive}>Interpret count bands with Live AI</button>}
            </div>
            {feature === "admin" && <p>Live interpretations use coarse counts only, may be inaccurate and require human review. They do not make administrative or academic decisions.</p>}
            <div role="status" aria-live="polite" aria-busy={pending}>
                {pending ? <p>{loadingLive ? "Interpreting count bands..." : "Loading static guidance..."}</p> : result && <>
                    <p>{result.message}</p>
                    {result.mode === "generated" ? <>
                        <p>{result.output.overview}</p>
                        <ul>{result.output.explanations.map(item => <li key={item.metricId}><strong>{metricLabels[item.metricId]}:</strong> {item.text}</li>)}</ul>
                        <p>Coarse bands are not exact counts. Withheld metrics cannot be inferred.</p>
                    </> : result.mode === "static" && <p>{result.guidance}</p>}
                </>}
            </div>
        </section>
    );
}
