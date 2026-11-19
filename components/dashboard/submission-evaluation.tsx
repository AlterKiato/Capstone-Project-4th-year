"use client";
import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { readSubmissionEvaluationAction, changeSubmissionEvaluationAction } from "@/lib/actions/submission-evaluation.action";
import { listEvaluationTemplatesAction } from "@/lib/actions/evaluation-template.action";
import { type CriterionAssessment, type EvaluationAssignment, type EvaluationDraft } from "@/lib/submission-evaluation";
import type { EvaluationTemplate } from "@/lib/evaluation-templates";
import css from "./submission-evaluation.module.css";
import { EvaluationFields, EvaluationWindow, assessmentProgress } from "./evaluation-workspace";
export { EvaluationConfirmation } from "./evaluation-workspace";

export function useSubmissionEvaluation(submissionId: number) {
    const [assignment, setAssignment] = useState<EvaluationAssignment | null>(null);
    const [assessments, setAssessments] = useState<CriterionAssessment[]>([]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(true);
    const alive = useRef(false), operation = useRef(false);
    useEffect(() => {
        let active = true;
        alive.current = true;
        void readSubmissionEvaluationAction({ submissionId }).then(result => {
            if (!active) return;
            if (result.success && result.data) setAssignment(result.data);
            else setError(result.message);
            setBusy(false);
        }).catch(() => { if (active) { setError("Evaluation unavailable. Reload before finalizing."); setBusy(false); } });
        return () => { active = false; alive.current = false; };
    }, [submissionId]);
    const draft: EvaluationDraft = { assignmentRevision: assignment?.revision ?? 0, assessments };
    async function change(template: { id: number; revision: number } | null) {
        if (operation.current || !assignment || error) return false;
        operation.current = true; setBusy(true);
        try {
            const result = await changeSubmissionEvaluationAction({ submissionId, expectedRevision: assignment.revision, template });
            if (!alive.current) return false;
            if (!result.success || !result.data) { setError(result.message); return false; }
            setAssignment(result.data); setAssessments([]); return true;
        } catch { if (alive.current) setError("Assignment outcome is unknown. Reload before continuing; ratings remain in this page only."); return false; }
        finally { operation.current = false; if (alive.current) setBusy(false); }
    }
    return { assignment, assessments, setAssessments, draft, busy, error, change };
}
export type EvaluationController = ReturnType<typeof useSubmissionEvaluation>;

export default function SubmissionEvaluation({ evaluation: state, disabled, hidden, onChange }: {
    evaluation: EvaluationController; disabled: boolean; hidden: boolean; onChange: () => void;
}) {
    const [chooser, setChooser] = useState(false), [open, setOpen] = useState(false);
    const [templates, setTemplates] = useState<EvaluationTemplate[]>([]), [selected, setSelected] = useState("");
    const [loading, setLoading] = useState(false), [message, setMessage] = useState("");
    const [clear, setClear] = useState(false);
    const entry = useRef<HTMLButtonElement>(null);
    const snapshot = state.assignment?.snapshot;
    const blocked = disabled || state.busy || !!state.error;
    async function choose() {
        setChooser(true); setSelected(""); setLoading(true); setMessage("");
        try { const result = await listEvaluationTemplatesAction({ includeArchived: false });
            if (result.success && result.data) setTemplates(result.data); else { setTemplates([]); setMessage(result.message); }
        } catch { setTemplates([]); setMessage("Templates could not be loaded."); }
        finally { setLoading(false); }
    }
    function update(row: CriterionAssessment) {
        onChange(); state.setAssessments(previous => [...previous.filter(item => item.criterionKey !== row.criterionKey), row]);
    }
    const summary = state.assignment ? assessmentProgress(state.assignment, state.draft) : "";
    return <>
        <div className={css.entry}>
            <span><strong>Evaluation Criteria</strong>{snapshot && <span className={css.assigned}>{snapshot.name}</span>}</span>
            <button ref={entry} type="button" disabled={blocked || hidden} onClick={() => snapshot ? setOpen(true) : void choose()}>{snapshot ? "Open Evaluation" : "Choose Template"}</button>
        </div>
        {state.error && <p role="alert" className="form-message">{state.error} Reload this submission to check the saved assignment. Unsaved ratings will be lost.</p>}
        {chooser && !hidden && <Dialog.Root open modal onOpenChange={value => { if (!state.busy) setChooser(value); }}><Dialog.Portal>
            <Dialog.Overlay className={css.overlay} /><Dialog.Content className={css.chooser} onCloseAutoFocus={event => { event.preventDefault(); entry.current?.focus(); }}>
                <Dialog.Title>Choose evaluation template</Dialog.Title>
                <Dialog.Description>{snapshot ? "Replacing this assignment clears the ratings in this page. The new template is frozen for this version." : "Select an active template for this submission version."}</Dialog.Description>
                <label htmlFor="evaluation-template">Template</label>
                <select id="evaluation-template" value={selected} disabled={loading || state.busy} onChange={event => setSelected(event.target.value)}>
                    <option value="">{loading ? "Loading templates…" : "Choose a template"}</option>
                    {templates.map(row => <option key={row.id} value={row.id}>{row.name} · {row.criteria.length} criteria · 1–{row.scale.levels.length}</option>)}
                </select>
                {!loading && !templates.length && !message && <p>No active templates. Create one in Evaluation Criteria.</p>}
                {message && <p role="status">{message}</p>}
                <div className={css.actions}><button type="button" disabled={state.busy} onClick={() => setChooser(false)}>Cancel</button>
                    <button type="button" disabled={loading || state.busy || !selected} onClick={async () => {
                        const template = templates.find(row => row.id === Number(selected)); if (!template) return;
                        onChange(); if (await state.change({ id: template.id, revision: template.revision })) { setChooser(false); setOpen(true); }
                    }}>{snapshot ? "Replace & Clear Ratings" : "Select Template"}</button></div>
                {state.error && <p role="alert">{state.error}</p>}
            </Dialog.Content></Dialog.Portal></Dialog.Root>}
        {clear && !hidden && <Dialog.Root open onOpenChange={value => { if (!state.busy) setClear(value); }}><Dialog.Portal><Dialog.Overlay className={css.overlay} />
            <Dialog.Content className={css.chooser} onCloseAutoFocus={event => { event.preventDefault(); entry.current?.focus(); }}><Dialog.Title>Clear evaluation assignment?</Dialog.Title><Dialog.Description>The saved assignment will be cleared. Ratings in this page will be discarded. Feedback and the academic status remain unchanged.</Dialog.Description>
                <div className={css.actions}><button type="button" disabled={state.busy} onClick={() => setClear(false)}>Cancel</button>
                    <button type="button" disabled={state.busy} onClick={async () => { onChange(); if (await state.change(null)) { setClear(false); setOpen(false); } }}>Clear Assignment &amp; Ratings</button></div>
                {state.error && <p role="alert">{state.error}</p>}
            </Dialog.Content></Dialog.Portal></Dialog.Root>}
        {snapshot && open && !hidden && <EvaluationWindow key={state.assignment!.revision} title={snapshot.name} summary={summary} restoreFocus={() => entry.current?.focus()} onClose={() => { setOpen(false); entry.current?.focus(); }}>
            <div className={css.scroll}>
                <p className={css.warning}>Ratings stay in this page only. Reloading discards them. Finalize with Review &amp; Confirm Decision.</p>
                <EvaluationFields snapshot={snapshot} assessments={state.assessments} disabled={blocked} onChange={update} />
            </div>
            <footer className={css.footer}><span aria-live="polite">{summary}</span><div className={css.actions}>
                <button type="button" disabled={blocked} onClick={() => { setOpen(false); void choose(); }}>Change Template</button>
                <button type="button" disabled={blocked} onClick={() => { setOpen(false); setClear(true); }}>Clear</button>
                <button type="button" onClick={() => { setOpen(false); entry.current?.focus(); }}>Done / Return to Review</button>
            </div></footer>
        </EvaluationWindow>}
    </>;
}
