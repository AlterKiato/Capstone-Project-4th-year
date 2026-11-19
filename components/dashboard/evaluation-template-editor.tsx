"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { templateDraftSchema } from "@/lib/validations/evaluation-template";
import { TEMPLATE_LIMITS as limits, type EvaluationTemplate, type EvaluationTemplateDraft, type TemplateResult } from "@/lib/evaluation-templates";
import ContextHelp from "./context-help";
import styles from "./evaluation-templates.module.css";

export default function EvaluationTemplateEditor({ initial, onSave, onClose }: {
    initial: EvaluationTemplateDraft; onSave: (draft: EvaluationTemplateDraft) => Promise<TemplateResult<EvaluationTemplate>>; onClose: () => void;
}) {
    const [draft, setDraft] = useState(initial);
    const [message, setMessage] = useState("");
    const [uncertain, setUncertain] = useState(false);
    const [pending, startTransition] = useTransition();
    const saving = useRef(false);
    const dirty = JSON.stringify(initial) !== JSON.stringify(draft);
    const blocked = pending || uncertain;
    useEffect(() => {
        if (!dirty && !pending) return;
        const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
        const navigate = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || !(event.target instanceof Element)) return;
            const link = event.target.closest<HTMLAnchorElement>("a[href]");
            const logout = event.target.closest('button[aria-label="Logout"]');
            if (!link && !logout) return;
            if (link && (link.target === "_blank" || link.hasAttribute("download") || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return;
            if (pending || !window.confirm("Discard unsaved template changes and leave?")) { event.preventDefault(); event.stopImmediatePropagation(); }
        };
        window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
        return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
    }, [dirty, pending]);
    function updateCriterion(key: string, patch: Partial<EvaluationTemplateDraft["criteria"][number]>) {
        setDraft(value => ({ ...value, criteria: value.criteria.map(row => row.key === key ? { ...row, ...patch } : row) }));
    }
    function move(index: number, direction: number) {
        const key = draft.criteria[index].key;
        setDraft(value => {
            const criteria = [...value.criteria], target = index + direction;
            [criteria[index], criteria[target]] = [criteria[target], criteria[index]];
            return { ...value, criteria: criteria.map((row, position) => ({ ...row, position })) };
        });
        requestAnimationFrame(() => document.getElementById(`criterion-${key}`)?.focus());
    }
    return <form className={styles.editor} aria-labelledby="template-editor-heading" aria-busy={pending} onSubmit={event => {
        event.preventDefault();
        if (saving.current || blocked) return;
        const parsed = templateDraftSchema.safeParse(draft);
        if (!parsed.success) { setMessage(parsed.error.issues[0]?.message ?? "Check the template fields."); return; }
        saving.current = true; setMessage("");
        startTransition(async () => {
            try {
                const result = await onSave(parsed.data);
                if (!result.success) { setMessage(result.message); setUncertain(result.kind !== "validation"); }
            } catch { setUncertain(true); setMessage("The save could not be confirmed. Return to the list and reload before retrying."); }
            finally { saving.current = false; }
        });
    }}>
        <div className={styles.toolbar}><h2 id="template-editor-heading">{initial.name ? "Edit template" : "Create template"}</h2>
            <ContextHelp label="About evaluation templates">Private to the current Main Adviser who creates them. Saving a template does not assess a submission or issue an academic decision. Draft changes are not automatically saved.</ContextHelp></div>
        <fieldset disabled={blocked}>
            <label htmlFor="template-name">Template name</label>
            <input id="template-name" required maxLength={limits.name} value={draft.name} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))} />
            <div className={styles.toolbar}><h3>Criteria ({draft.criteria.length}/{limits.criteria})</h3>
                <button type="button" className={styles.secondary} disabled={draft.criteria.length >= limits.criteria} onClick={() => setDraft(value => ({ ...value,
                    criteria: [...value.criteria, { key: crypto.randomUUID(), name: "", description: "", allowsNa: false, position: value.criteria.length }] }))}>Add criterion</button></div>
            <ol className={styles.criteria}>{draft.criteria.map((row, index) => <li key={row.key}>
                <div className={styles.criterionRow}><div className={styles.nameField}><label htmlFor={`criterion-${row.key}`}>Criterion {index + 1}</label>
                    <input id={`criterion-${row.key}`} value={row.name} required maxLength={limits.name} onChange={event => updateCriterion(row.key, { name: event.target.value })} /></div>
                    <div className={styles.rowActions}>
                        <button type="button" className={styles.secondary} aria-label={`Move criterion ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>Up</button>
                        <button type="button" className={styles.secondary} aria-label={`Move criterion ${index + 1} down`} disabled={index === draft.criteria.length - 1} onClick={() => move(index, 1)}>Down</button>
                        <button type="button" className={styles.secondary} aria-label={`Remove criterion ${index + 1}`} disabled={draft.criteria.length === 1} onClick={() => {
                            if ((row.name || row.description || row.allowsNa) && !window.confirm("Remove this criterion from the draft?")) return;
                            setDraft(value => ({ ...value, criteria: value.criteria.filter(item => item.key !== row.key).map((item, position) => ({ ...item, position })) }));
                        }}>Remove</button>
                    </div></div>
                <details className={styles.options}><summary>Criterion {index + 1} options</summary>
                    <label htmlFor={`description-${row.key}`}>Description (optional)</label>
                    <textarea id={`description-${row.key}`} rows={2} maxLength={limits.description} value={row.description} onChange={event => updateCriterion(row.key, { description: event.target.value })} />
                    <label className={styles.checkbox}><input type="checkbox" checked={row.allowsNa} onChange={event => updateCriterion(row.key, { allowsNa: event.target.checked })} />Allow N/A for this criterion</label>
                </details>
            </li>)}</ol>
            <section className={styles.scale} aria-labelledby="template-scale-heading"><h3 id="template-scale-heading">Rating scale</h3>
                <p className={styles.scaleSummary}>{draft.scale.levels.map(level => `${level.points} ${level.label || "(label required)"}`).join(" · ")}</p>
                <details className={styles.options}><summary>Customize scale</summary>
                    <label htmlFor="scale-size">Number of rating levels</label>
                    <select id="scale-size" value={draft.scale.levels.length} onChange={event => {
                        const size = Number(event.target.value);
                        if (size < draft.scale.levels.length && !window.confirm("Remove the highest rating levels from this draft?")) return;
                        setDraft(value => ({ ...value, scale: { version: 1, levels: Array.from({ length: size }, (_, index) =>
                            value.scale.levels[index] ?? { points: index + 1, label: `Level ${index + 1}`, description: "" }) } }));
                    }}>{[2, 3, 4, 5].map(size => <option key={size} value={size}>{size} levels</option>)}</select>
                    <ol className={styles.scaleLevels}>{draft.scale.levels.map((level, index) => <li key={level.points}>
                        <label htmlFor={`level-${level.points}`}>{level.points} point{level.points === 1 ? "" : "s"}: label</label>
                        <input id={`level-${level.points}`} required maxLength={limits.label} value={level.label} onChange={event => setDraft(value => ({ ...value, scale: { ...value.scale,
                            levels: value.scale.levels.map((item, i) => i === index ? { ...item, label: event.target.value } : item) } }))} />
                        <label htmlFor={`level-description-${level.points}`}>Short description (optional)</label>
                        <input id={`level-description-${level.points}`} maxLength={limits.scaleDescription} value={level.description} onChange={event => setDraft(value => ({ ...value, scale: { ...value.scale,
                            levels: value.scale.levels.map((item, i) => i === index ? { ...item, description: event.target.value } : item) } }))} />
                    </li>)}</ol>
                </details>
            </section>
        </fieldset>
        {message && <p className="form-message" role="alert">{message}</p>}
        {uncertain && <p className="form-help">Your draft is retained here. Return to the template list and reload the saved data before trying again.</p>}
        <div className={styles.actions}><button type="submit" disabled={blocked}>{pending ? "Saving…" : "Save template"}</button>
            <button type="button" className={styles.secondary} disabled={pending} onClick={() => { if (!dirty || window.confirm("Discard unsaved template changes?")) onClose(); }}>Back to templates</button></div>
    </form>;
}
