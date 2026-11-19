"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { listEvaluationTemplatesAction, readEvaluationTemplateAction, mutateEvaluationTemplateAction } from "@/lib/actions/evaluation-template.action";
import { defaultTemplateScale, type EvaluationTemplate, type EvaluationTemplateDraft, type TemplateResult } from "@/lib/evaluation-templates";
import EvaluationTemplateEditor from "./evaluation-template-editor";
import ResearchDialog from "./research-dialog";
import styles from "./evaluation-templates.module.css";

export default function EvaluationTemplateManager({ initial }: { initial: TemplateResult<EvaluationTemplate[]> }) {
    const [rows, setRows] = useState(initial.data ?? []);
    const [showArchived, setShowArchived] = useState(false);
    const [error, setError] = useState(initial.success ? "" : initial.message);
    const [notice, setNotice] = useState("");
    const [needsReload, setNeedsReload] = useState(!initial.success);
    const [editor, setEditor] = useState<{ saved?: EvaluationTemplate; draft: EvaluationTemplateDraft } | null>(null);
    const [archive, setArchive] = useState<EvaluationTemplate | null>(null);
    const [pending, startTransition] = useTransition();
    const busy = useRef(false);
    function acknowledged(result: TemplateResult<EvaluationTemplate>) {
        if (result.success && result.data) {
            const saved = result.data;
            setRows(value => [saved, ...value.filter(row => row.id !== saved.id)]); setNotice(result.message); setError("");
        } else if (!result.success) {
            setError(result.message);
            if (result.kind !== "validation") setNeedsReload(true);
        }
        return result;
    }
    async function mutate(input: unknown) {
        try { return acknowledged(await mutateEvaluationTemplateAction(input)); }
        catch { return acknowledged({ success: false, kind: "unavailable", message: "The change could not be confirmed. Reload the saved templates before retrying." }); }
    }
    function reload() {
        if (busy.current) return;
        busy.current = true;
        startTransition(async () => {
            try {
                const result = await listEvaluationTemplatesAction({ includeArchived: true });
                setError(result.success ? "" : result.message); setNeedsReload(!result.success);
                if (result.success && result.data) { setRows(result.data); setNotice("Templates reloaded."); }
            } catch { setError("Templates could not be loaded. Reload to try again."); setNeedsReload(true); }
            finally { busy.current = false; }
        });
    }
    function edit(row: EvaluationTemplate) {
        if (busy.current) return;
        busy.current = true;
        startTransition(async () => {
            try {
                const result = await readEvaluationTemplateAction({ templateId: row.id });
                if (result.success && result.data && !result.data.archivedAt) {
                    const { name, scale, criteria } = result.data;
                    setEditor({ saved: result.data, draft: { name, scale, criteria } }); setNotice("");
                } else { setError(result.success ? "This template is archived. Reload the list." : result.message); setNeedsReload(true); }
            } catch { setError("Template could not be loaded. Reload the list."); setNeedsReload(true); }
            finally { busy.current = false; }
        });
    }
    function duplicate(row: EvaluationTemplate) {
        if (busy.current) return;
        busy.current = true;
        startTransition(async () => {
            try { await mutate({ operation: "duplicate", templateId: row.id, expectedRevision: row.revision }); }
            catch { setError("The copy could not be confirmed. Reload before retrying."); setNeedsReload(true); }
            finally { busy.current = false; }
        });
    }
    if (editor) return <section className={`dashboard-panel ${styles.panel}`}><EvaluationTemplateEditor key={editor.saved?.id ?? "new"} initial={editor.draft} onClose={() => setEditor(null)}
        onSave={async draft => {
            const result = await mutate(editor.saved
                ? { operation: "update", templateId: editor.saved.id, expectedRevision: editor.saved.revision, draft }
                : { operation: "create", draft });
            if (result.success) setEditor(null);
            return result;
        }} /></section>;
    const visible = rows.filter(row => showArchived || !row.archivedAt);
    return <>
        <Link className="research-back context-back" href="/dashboard/adviser/submissions">Back to submissions</Link>
        <section className={`dashboard-panel ${styles.panel}`} aria-labelledby="templates-heading" aria-busy={pending}>
            <div className={styles.toolbar}><h2 id="templates-heading">Saved templates</h2><button disabled={pending || needsReload} type="button" onClick={() => {
                setEditor({ draft: { name: "", scale: defaultTemplateScale(), criteria: [{ key: crypto.randomUUID(), name: "", description: "", position: 0, allowsNa: false }] } }); setNotice("");
            }}>Create template</button></div>
            <div className={styles.toolbar}><label className={styles.checkbox}><input type="checkbox" checked={showArchived} disabled={pending} onChange={event => setShowArchived(event.target.checked)} />Show archived</label>
                <button type="button" className={styles.secondary} disabled={pending} onClick={reload}>{pending ? "Loading…" : "Reload templates"}</button></div>
            {error && <p className="form-message" role="alert">{error}</p>}
            <p role="status" className="form-help">{pending ? "Loading templates…" : notice}</p>
            {!error && !visible.length && <p>No {showArchived ? "saved" : "active"} templates. Create one to reuse its criteria and rating scale.</p>}
            <ul className={styles.list}>{visible.map(row => <li key={row.id}>
                <div className={styles.rowText}><h3>{row.name}</h3><p className="form-help">{row.criteria.length} {row.criteria.length === 1 ? "criterion" : "criteria"} · {row.scale.levels.length} rating levels (1–{row.scale.levels.length}){row.archivedAt ? " · Archived" : ""}</p></div>
                {!row.archivedAt && <div className={styles.rowActions}>
                    <button type="button" className={styles.secondary} disabled={pending || needsReload} aria-label={`Edit template: ${row.name}`} onClick={() => edit(row)}>Edit</button>
                    <button type="button" className={styles.secondary} disabled={pending || needsReload} aria-label={`Duplicate template: ${row.name}`} onClick={() => duplicate(row)}>Duplicate</button>
                    <button type="button" className={styles.secondary} disabled={pending || needsReload} aria-label={`Archive template: ${row.name}`} onClick={() => setArchive(row)}>Archive</button>
                </div>}
            </li>)}</ul>
        </section>
        {archive && <ResearchDialog title="Archive evaluation template" submitLabel="Archive template" showCancel submitDisabled={needsReload} onClose={() => setArchive(null)} onSuccess={() => setArchive(null)}
            action={async () => mutate({ operation: "archive", templateId: archive.id, expectedRevision: archive.revision })}>
            <p>Archive <strong>{archive.name}</strong>? It will be unavailable for new evaluations and further editing.</p>
        </ResearchDialog>}
    </>;
}
