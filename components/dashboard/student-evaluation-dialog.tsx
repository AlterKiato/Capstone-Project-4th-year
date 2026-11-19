"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { getStudentEvaluationAction } from "@/lib/actions/student-evaluation.action";
import type { StudentEvaluationRequest, StudentEvaluationResult } from "@/lib/student-evaluation";
import styles from "./student-ui.module.css";
import resultStyles from "./student-evaluation.module.css";

export default function StudentEvaluationDialog({ request, onClose }: {
    request: StudentEvaluationRequest; onClose: () => void;
}) {
    const ref = useRef<HTMLDialogElement>(null), heading = useId();
    const [result, setResult] = useState<StudentEvaluationResult | null>(null);
    const [pending, startTransition] = useTransition();
    useEffect(() => {
        const dialog = ref.current!, previous = document.activeElement as HTMLElement | null;
        const overflow = document.body.style.overflow;
        dialog.showModal(); document.body.style.overflow = "hidden";
        let active = true;
        startTransition(async () => {
            try {
                const response = await getStudentEvaluationAction(request);
                if (active) setResult(response);
            } catch { if (active) setResult({ success: false, message: "Evaluation unavailable. Reload this submission and try again." }); }
        });
        return () => { active = false; dialog.close(); document.body.style.overflow = overflow; previous?.focus(); };
    }, [request]);
    const evaluation = result?.success ? result.data : null;
    return <dialog ref={ref} className={`${styles.feedbackDialog} ${resultStyles.dialog}`} aria-labelledby={heading}
        onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => {
            if (event.key !== "Tab") return;
            const controls = Array.from(ref.current!.querySelectorAll<HTMLElement>("button, summary, [tabindex='0']"))
                .filter(element => element.getClientRects().length > 0);
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
        <div className={styles.dialogHeader}><h2 id={heading}>Official evaluation · {request.version}</h2>
            <button type="button" className={styles.toggle} onClick={onClose} aria-label="Close evaluation">Close</button></div>
        <div className={styles.feedbackScroll} tabIndex={0} aria-label="Official evaluation results" aria-busy={pending}>
            {!result ? <p role="status">Loading evaluation…</p> : !result.success ? <p role="alert">{result.message}</p> : !evaluation ?
                <p>No criteria-based evaluation for this review.</p> : <>
                    <h3>{evaluation.templateName}</h3>
                    <p>Template revision {evaluation.templateRevision} · Finalized <time dateTime={evaluation.finalizedAt}>{new Date(evaluation.finalizedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</time></p>
                    <p><strong>{evaluation.earned} / {evaluation.possible} points</strong></p>
                    <p className="form-help">These points describe feedback for this version. They are not an automatic academic grade or decision.</p>
                    <details><summary>Rating scale · {evaluation.scale.levels.length} points</summary>
                        <ul>{evaluation.scale.levels.map(level => <li key={level.points}><strong>{level.points}: {level.label}</strong>{level.description && <p>{level.description}</p>}</li>)}</ul>
                    </details>
                    <ol className={resultStyles.criteria}>{evaluation.criteria.map((criterion, index) => {
                        const level = evaluation.scale.levels.find(item => item.points === criterion.rating);
                        return <li key={index}><h4>{criterion.name}</h4>{criterion.description && <p>{criterion.description}</p>}
                            <p><strong>{criterion.na ? "N/A" : `${criterion.rating}: ${level?.label}`}</strong></p>
                            {!criterion.na && level?.description && <p>{level.description}</p>}
                            {criterion.na && <p><strong>N/A reason:</strong> {criterion.reason}</p>}
                            {criterion.comment && <p><strong>Comment:</strong> {criterion.comment}</p>}
                        </li>;
                    })}</ol>
                </>}
        </div>
    </dialog>;
}
