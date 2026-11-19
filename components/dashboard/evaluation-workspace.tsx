"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { createPortal } from "react-dom";
import { assessEvaluation, type CriterionAssessment, type EvaluationAssignment, type EvaluationDraft, type EvaluationSnapshot } from "@/lib/submission-evaluation";
import css from "./submission-evaluation.module.css";
const mobileQuery = "(max-width: 767px)";
const subscribe = (notify: () => void) => { const query = matchMedia(mobileQuery); query.addEventListener("change", notify); return () => query.removeEventListener("change", notify); };
const mobileSnapshot = () => matchMedia(mobileQuery).matches;

export function assessmentProgress(assignment: EvaluationAssignment, draft: EvaluationDraft) {
    if (!assignment.snapshot) return "";
    try { const points = assessEvaluation(assignment, draft); return `${points.earned} / ${points.possible} points`; }
    catch { return `${draft.assessments.filter(row => row.na ? row.reason.trim() : row.rating !== null).length} / ${assignment.snapshot.criteria.length} assessed`; }
}

export function EvaluationFields({ snapshot, assessments, disabled, onChange }: { snapshot: EvaluationSnapshot; assessments: CriterionAssessment[]; disabled: boolean; onChange: (row: CriterionAssessment) => void }) {
    return <>
                {snapshot.criteria.map(criterion => {
                    const row = assessments.find(item => item.criterionKey === criterion.key.toLowerCase()) ?? { criterionKey: criterion.key.toLowerCase(), rating: null, na: false, reason: "", comment: "" };
                    const id = `criterion-${criterion.key}`;
                    return <fieldset key={criterion.key} className={css.criterion} disabled={disabled}>
                        <legend>{criterion.position + 1}. {criterion.name}</legend>
                        <label htmlFor={id}>Rating</label><select id={id} value={row.na ? "na" : row.rating ?? ""} onChange={event => onChange({ ...row,
                            na: event.target.value === "na", rating: event.target.value && event.target.value !== "na" ? Number(event.target.value) : null, reason: "" })}>
                            <option value="">Choose a rating</option>{snapshot.scale.levels.map(level => <option key={level.points} value={level.points}>{level.points}: {level.label}</option>)}
                            {criterion.allowsNa && <option value="na">N/A</option>}
                        </select>
                        {row.na && <label>N/A reason (required)<textarea value={row.reason} maxLength={2000} onChange={event => onChange({ ...row, reason: event.target.value })} /></label>}
                        <details><summary>Description &amp; rating guide</summary>{criterion.description && <p>{criterion.description}</p>}
                            <dl>{snapshot.scale.levels.map(level => <div key={level.points}><dt>{level.points} — {level.label}</dt>{level.description && <dd>{level.description}</dd>}</div>)}</dl></details>
                        <details><summary>Criterion comment (optional)</summary><label>Comment for {criterion.name}<textarea value={row.comment} maxLength={2000} onChange={event => onChange({ ...row, comment: event.target.value })} /></label></details>
                    </fieldset>;
                })}
    </>;
}

export function EvaluationWindow({ title, summary, onClose, restoreFocus, children }: { title: string; summary: string; onClose: () => void; restoreFocus: () => void; children: React.ReactNode }) {
    const mobile = useSyncExternalStore(subscribe, mobileSnapshot, () => false);
    const panel = useRef<HTMLDivElement>(null), handle = useRef<HTMLDivElement>(null);
    const drag = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null);
    const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
    const titleId = useId(), descriptionId = useId();
    useEffect(() => { if (!mobile) handle.current?.focus(); }, [mobile]);
    function move(left: number, top: number) {
        const rect = panel.current?.getBoundingClientRect(); if (!rect) return;
        setPosition({ left: Math.max(12, Math.min(left, innerWidth - rect.width - 12)), top: Math.max(12, Math.min(top, innerHeight - rect.height - 12)) });
    }
    useEffect(() => {
        const resize = () => { const rect = panel.current?.getBoundingClientRect(); if (rect && !matchMedia(mobileQuery).matches) move(rect.left, rect.top); drag.current = null; };
        window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize);
    }, []);
    function start(event: PointerEvent<HTMLDivElement>) {
        if (mobile || !event.isPrimary || event.button !== 0 || (event.target as Element).closest("button")) return;
        const rect = panel.current!.getBoundingClientRect(); event.preventDefault(); handle.current?.focus(); event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    }
    const contents = <>
        <header className={css.header}><div ref={handle} className={css.handle} tabIndex={mobile ? -1 : 0} title={mobile ? undefined : "Drag to move; arrow keys move the window"}
            aria-label="Move evaluation window with arrow keys" onPointerDown={start} onPointerMove={event => {
                const current = drag.current; if (current?.id === event.pointerId && !mobile) move(current.left + event.clientX - current.x, current.top + event.clientY - current.y);
            }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
            onKeyDown={event => { if (!mobile && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
                event.preventDefault(); const rect = panel.current!.getBoundingClientRect(); move(rect.left + (event.key === "ArrowLeft" ? -24 : event.key === "ArrowRight" ? 24 : 0), rect.top + (event.key === "ArrowUp" ? -24 : event.key === "ArrowDown" ? 24 : 0));
            } }}>{mobile ? <Dialog.Title asChild><h2 title={title}>{title}</h2></Dialog.Title> : <h2 id={titleId} title={title}>{title}</h2>}
            {mobile ? <Dialog.Description asChild><p>Working evaluation · {summary}</p></Dialog.Description> : <p id={descriptionId}>Working evaluation · {summary}</p>}</div>
            <button type="button" onClick={onClose}>Minimize</button><button type="button" onClick={onClose} aria-label="Close evaluation window">Close</button>
        </header>{children}
    </>;
    if (mobile) return <Dialog.Root open onOpenChange={value => { if (!value) onClose(); }}><Dialog.Portal><Dialog.Overlay className={css.overlay} />
        <Dialog.Content ref={panel} className={css.window} aria-modal="true" data-mobile="true" onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}>{contents}</Dialog.Content>
    </Dialog.Portal></Dialog.Root>;
    return createPortal(<div ref={panel} className={css.window} style={position ?? undefined} role="dialog" aria-modal="false" aria-labelledby={titleId} aria-describedby={descriptionId} data-mobile="false"
        onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }}>{contents}</div>, document.body);
}

export function EvaluationConfirmation({ assignment, draft, privateRecommendation = false }: { assignment: EvaluationAssignment; draft: EvaluationDraft; privateRecommendation?: boolean }) {
    if (!assignment.snapshot) return null;
    const points = assessEvaluation(assignment, draft);
    return <section className={css.confirmation}><h4>{assignment.snapshot.name} · template revision {assignment.snapshot.sourceRevision} · assignment revision {assignment.revision}</h4>
        <p>{points.earned} / {points.possible} points. {privateRecommendation ? "Private recommendation; points do not change academic status." : "The academic decision is independent of points."}</p>
        <ol>{assignment.snapshot.criteria.map(criterion => { const row = points.items.find(item => item.criterionKey === criterion.key.toLowerCase())!;
            return <li key={criterion.key}><strong>{criterion.name}</strong>: {row.na ? `N/A: ${row.reason}` : `${row.rating}: ${assignment.snapshot!.scale.levels.find(level => level.points === row.rating)!.label}`}{row.comment && <p>{row.comment}</p>}</li>;
        })}</ol></section>;
}
