"use client";
import { useEffect, useRef, useState } from "react";
import { getDeveloperEvaluationAvailabilityAction, runDeveloperEvaluationAction } from "@/lib/actions/developer-ai-evaluation.action";
import { RESEARCH_DEMO_EXCERPT, RESEARCH_DEMO_QUESTIONS, RESEARCH_DEMO_FOLLOWUPS } from "@/lib/ai/adviser-research-demo";
import type { DeveloperEvaluationRequest } from "@/lib/validations/developer-ai-evaluation";
import type { DeveloperEvaluationResult } from "@/lib/services/developer-ai-evaluation.service";

type Props = { disabled?: boolean } & ({ feature: "admin" } | { feature: "adviser"; submissionId: number; assignmentId?: number });
type Availability = Awaited<ReturnType<typeof getDeveloperEvaluationAvailabilityAction>>;
const labels: Record<string, string> = { totalUsers: "Accounts", totalGroups: "Research groups",
    totalResearchPapers: "Research papers", totalPublishedPapers: "Published papers" };

export default function DeveloperAIEvaluation(props: Props) {
    const { feature, disabled = false } = props;
    const submissionId = props.feature === "adviser" ? props.submissionId : undefined;
    const assignmentId = props.feature === "adviser" ? props.assignmentId : undefined;
    const [availability, setAvailability] = useState<Availability>({ available: false });
    const [refreshRevision, setRefreshRevision] = useState(0);
    const [questionId, setQuestionId] = useState<"primary" | "explain-improvement" | "verify-next">("primary");
    const [result, setResult] = useState<DeveloperEvaluationResult | null>(null), [pending, setPending] = useState(false);
    const sequence = useRef(0), busy = useRef(false);
    useEffect(() => {
        let mounted = true;
        const input = feature === "admin" ? { feature } : { feature, submissionId, assignmentId, questionId: "primary" };
        async function refresh() {
            if (busy.current && !disabled) return;
            const current = ++sequence.current;
            try {
                const value = disabled ? { available: false } as const : await getDeveloperEvaluationAvailabilityAction(input);
                if (!mounted || current !== sequence.current) return;
                setAvailability(value);
                if (!value.available) setResult(null);
            } catch {
                if (mounted && current === sequence.current) { setAvailability({ available: false }); setResult(null); }
            }
        }
        void refresh();
        const visible = () => { if (document.visibilityState === "visible") void refresh(); };
        const invalidate = () => { sequence.current++; };
        window.addEventListener("focus", visible); document.addEventListener("visibilitychange", visible);
        return () => { mounted = false; invalidate(); window.removeEventListener("focus", visible);
            document.removeEventListener("visibilitychange", visible); };
    }, [feature, submissionId, assignmentId, disabled, refreshRevision]);

    async function generate() {
        if (busy.current || disabled || !availability.available || !availability.budget || availability.budget.remaining === 0 ||
            availability.budget.busy || availability.budget.waitSeconds > 0) return;
        const input: DeveloperEvaluationRequest = props.feature === "admin" ? { feature: "admin" } : {
            feature: "adviser", submissionId: props.submissionId,
            ...(props.assignmentId === undefined ? {} : { assignmentId: props.assignmentId }), questionId,
        };
        busy.current = true; const current = ++sequence.current;
        setPending(true); setResult(null);
        try {
            const generated = await runDeveloperEvaluationAction(input);
            const next = await getDeveloperEvaluationAvailabilityAction(input);
            if (current !== sequence.current) return;
            setAvailability(next); setResult(next.available ? generated : null);
        } catch {
            if (current === sequence.current) setResult({ mode: "unavailable", message: "AI evaluation failed. No generated answer is shown. No automatic retry." });
        } finally { busy.current = false; setPending(false); }
    }

    if (disabled || !availability.available) return null;
    const budget = availability.budget, blocked = pending || !budget || budget.remaining === 0 || budget.busy || budget.waitSeconds > 0;
    return <details>
        <summary>AI Evaluation — Synthetic Data</summary>
        <p>Synthetic data only, sent to external provider Groq. AI explanations may be inaccurate. Do not base academic or administrative decisions solely on this output. Separate from Demo/static guidance and the institutional Live pilot.</p>
        {budget ? <p>Today (UTC): {budget.accountRemaining}/3 account attempts and {budget.globalRemaining}/10 shared attempts remain.
            {" "}Cooldown: {budget.waitSeconds} seconds.{budget.busy ? " A request is already in progress." : ""}
            {budget.remaining === 0 ? " Daily request limit reached." : ""}</p> : <p role="status">{availability.message}</p>}
        {feature === "adviser" ? <>
            <details><summary>Fixed fictional writing input</summary><p style={{ whiteSpace: "pre-wrap" }}>{RESEARCH_DEMO_EXCERPT}</p></details>
            <label>Academic Writing Review question <select value={questionId} disabled={pending}
                onChange={event => { const value = event.target.value;
                    if (value === "primary" || value === "explain-improvement" || value === "verify-next") setQuestionId(value); }}>
                <option value="primary">{RESEARCH_DEMO_QUESTIONS.writing}</option>
                <option value="explain-improvement">{RESEARCH_DEMO_FOLLOWUPS[0]}</option>
                <option value="verify-next">{RESEARCH_DEMO_FOLLOWUPS[1]}</option>
            </select></label>
        </> : <ul aria-label="Fixed synthetic count bands">{Object.entries(availability.syntheticBands ?? {}).map(([metric, band]) =>
            <li key={metric}>{labels[metric]}: {band}</li>)}</ul>}
        <div className="surface-actions"><button type="button" disabled={blocked} onClick={() => void generate()}>Generate AI evaluation</button>
            <button type="button" disabled={pending} onClick={() => setRefreshRevision(value => value + 1)}>Refresh availability</button></div>
        <div role="status" aria-live="polite" aria-busy={pending}>
            {pending ? <p>Waiting for Groq…</p> : result?.mode === "generated" ? <>
                <p>Groq-generated AI evaluation — synthetic data. This is not Demo output.</p>
                {result.feature === "adviser" ? <dl>{[["Observation", result.answer.observation], ["Explanation", result.answer.explanation],
                    ["Suggested improvement", result.answer.suggestion], ["Limitation", result.answer.limitation]].map(([label, text]) =>
                    <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl> : <>
                    <p>{result.output.overview}</p><ul>{result.output.explanations.map(item =>
                        <li key={item.metricId}><strong>{labels[item.metricId]} ({item.band}):</strong> {item.text}</li>)}</ul>
                    <p>Canonical bands are server-owned. Coarse counts do not establish trends or justify decisions.</p>
                </>}
            </> : result && <p>{result.message}</p>}
        </div>
    </details>;
}
