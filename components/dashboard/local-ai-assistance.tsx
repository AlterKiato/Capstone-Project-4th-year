"use client";

import { useState, useTransition } from "react";
import { ConsentDialog } from "@/components/dashboard/ai-governance-dialogs";
import { getLocalAdminAssistanceAction, getLocalAdviserAssistanceAction } from "@/lib/actions/ai-foundation.action";
import type { LocalAIResult } from "@/types/ai-foundation";

const adviserQuestions = [
    ["adviser-workflow-overview-v1", "Explain submission workflow counts"],
    ["adviser-start-review-v1", "How do I start review?"],
    ["adviser-record-decision-v1", "How do I record my decision?"],
    ["adviser-revision-history-v1", "How does revision history work?"],
] as const;

export default function LocalAIAssistance({ feature }: { feature: "admin" | "adviser" }) {
    const [result, setResult] = useState<LocalAIResult | null>(null);
    const [pending, startTransition] = useTransition();
    function select(id: string) {
        setResult(null);
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
        <section aria-label={feature === "admin" ? "Admin report assistance" : "Adviser workflow assistance"} style={{ border: "1px solid #ddd", padding: 16, margin: "24px 0" }}>
            <h2>{feature === "admin" ? "Admin report assistance" : "Adviser workflow assistance"}</h2>
            <ConsentDialog />
            <p>AI interpretation is disabled. Choose a predefined question for verified static guidance.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {feature === "admin" ? <button type="button" disabled={pending} onClick={() => select("admin-overview-v1")}>Explain report metrics</button>
                    : adviserQuestions.map(([id, label]) => <button key={id} type="button" disabled={pending} onClick={() => select(id)}>{label}</button>)}
            </div>
            <div role="status" aria-live="polite" aria-busy={pending}>
                {pending ? <p>Loading static guidance...</p> : result && <><p>{result.message}</p>{result.success && <p>{result.guidance}</p>}</>}
            </div>
        </section>
    );
}
