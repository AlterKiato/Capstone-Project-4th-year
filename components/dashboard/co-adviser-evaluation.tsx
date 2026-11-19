"use client";
import { useEffect, useRef, useState } from "react";
import { getCoAdviserEvaluationAction } from "@/lib/actions/co-adviser.action";
import type { CriterionAssessment, EvaluationAssignment } from "@/lib/submission-evaluation";
import type { CoAssessmentView } from "@/lib/co-evaluation";
import { EvaluationFields, EvaluationWindow, EvaluationConfirmation, assessmentProgress } from "./evaluation-workspace";
import css from "./submission-evaluation.module.css";

export function useCoEvaluation(assignmentId: number, submissionId: number, enabled: boolean) {
    const [assignment, setAssignment] = useState<EvaluationAssignment | null>(null);
    const [assessments, setAssessments] = useState<CriterionAssessment[]>([]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(enabled);
    const [generation, setGeneration] = useState(0);
    useEffect(() => {
        if (!enabled) return;
        let active = true;
        void getCoAdviserEvaluationAction({ assignmentId, submissionId }).then(result => {
            if (!active) return;
            if (result.success && result.data) { setAssignment(result.data); setError(""); }
            else { setAssignment(null); setError(result.message); }
            setBusy(false);
        }).catch(() => { if (active) { setAssignment(null); setError("Assigned criteria unavailable. You can submit a narrative-only recommendation or reload."); setBusy(false); } });
        return () => { active = false; };
    }, [assignmentId, submissionId, enabled, generation]);
    function reset() { setAssessments([]); setAssignment(null); setError(""); setBusy(true); setGeneration(value => value + 1); }
    return { assignment, assessments, setAssessments, error, busy, reset,
        draft: { assignmentRevision: assignment?.revision ?? 0, assessments } };
}

export default function CoAdviserEvaluation({ state, include, onInclude, disabled, hidden }: {
    state: ReturnType<typeof useCoEvaluation>; include: boolean; onInclude: (value: boolean) => void; disabled: boolean; hidden: boolean;
}) {
    const [open, setOpen] = useState(false), entry = useRef<HTMLButtonElement>(null);
    const snapshot = state.assignment?.snapshot;
    if (!snapshot || !state.assignment) return state.error ? <p className="form-help" role="status">{state.error} Criteria are optional; narrative-only submission remains available.</p> : null;
    const blocked = disabled || state.busy || !!state.error;
    const summary = assessmentProgress(state.assignment, state.draft);
    return <>
        <div className={`${css.entry} ${css.coEntry}`}>
            <span><strong>Evaluation Criteria</strong><span className={css.assigned}>{snapshot.name}</span></span>
            <label className={css.include}><input type="checkbox" checked={include} disabled={blocked || hidden} onChange={event => onInclude(event.target.checked)} />Include ratings</label>
            <button ref={entry} type="button" disabled={blocked || hidden} onClick={() => setOpen(true)}>Open Evaluation</button>
        </div>
        {open && !hidden && <EvaluationWindow title={snapshot.name} summary={summary} onClose={() => { setOpen(false); entry.current?.focus(); }} restoreFocus={() => entry.current?.focus()}>
            <div className={css.scroll}><p className={css.warning}>Ratings stay in this page only. Included ratings submit privately with your recommendation; reloading discards unsaved ratings.</p>
                <EvaluationFields snapshot={snapshot} assessments={state.assessments} disabled={blocked} onChange={row => {
                    onInclude(true); state.setAssessments(previous => [...previous.filter(item => item.criterionKey !== row.criterionKey), row]);
                }} />
            </div>
            <footer className={css.footer}><span aria-live="polite">{summary}</span><div className={css.actions}>
                <button type="button" disabled={blocked || !state.assessments.length} onClick={() => { if (window.confirm("Discard the criterion ratings in this page? Your narrative will be kept.")) { state.setAssessments([]); onInclude(false); } }}>Clear Ratings</button>
                <button type="button" onClick={() => { setOpen(false); entry.current?.focus(); }}>Done / Return to Recommendation</button>
            </div></footer>
        </EvaluationWindow>}
    </>;
}

export function CoAssessmentDetails({ value }: { value: CoAssessmentView }) {
    return <details className={css.recorded}><summary>Criteria recommendation: {value.earned} / {value.possible} points · {value.stale ? "Stale" : "Current"}</summary>
        {value.stale && <p className="form-help">Assignment changed. These ratings retain their historical meaning.</p>}
        <EvaluationConfirmation assignment={value.assignment} draft={value.draft} privateRecommendation />
    </details>;
}
