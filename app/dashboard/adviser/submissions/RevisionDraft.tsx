"use client";
import { createContext, useContext, useState } from "react";
import type { RevisionDraft } from "@/lib/validations/revision";
import ContextHelp from "@/components/dashboard/context-help";
import styles from "@/components/dashboard/revisions.module.css";

const Context = createContext<{ items: RevisionDraft[]; setItems: (items: RevisionDraft[]) => void; locked: boolean; setLocked: (value: boolean) => void } | null>(null);
export function useRevisionDraft() { return useContext(Context); }
export default function RevisionDraftProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<RevisionDraft[]>([]);
    const [locked, setLocked] = useState(false);
    return <Context.Provider value={{ items, setItems, locked, setLocked }}>{children}</Context.Provider>;
}
export function RevisionDraftEditor() {
    const draft = useRevisionDraft();
    if (!draft) return null;
    const { items, setItems, locked } = draft;
    return <section className={styles.checklist} aria-labelledby="draft-corrections-heading">
        <div className={styles.heading}><h3 id="draft-corrections-heading">Draft corrections ({items.length})</h3>
            <ContextHelp label="About draft corrections">Corrections are saved only when you finalize Revision Required in Review. Approved does not publish them. Drafts are kept while switching tabs.</ContextHelp></div>
        <p className="form-help">Unsaved · Finalize in Review</p>
        {!items.length && <p>No draft corrections. Add only the changes this version needs.</p>}
        <ol className={styles.items}>{items.map((item, index) => <li key={index} className={styles.item}>
            <label htmlFor={`correction-${index}`}>Correction {index + 1}</label>
            <textarea id={`correction-${index}`} rows={3} maxLength={2000} value={item.correction} disabled={locked} onChange={event => setItems(items.map((row, i) => i === index ? { ...row, correction: event.target.value } : row))} />
            <label htmlFor={`reference-${index}`}>Page or section (optional)</label>
            <input id={`reference-${index}`} maxLength={120} value={item.reference} disabled={locked} onChange={event => setItems(items.map((row, i) => i === index ? { ...row, reference: event.target.value } : row))} />
            <button type="button" disabled={locked} onClick={() => setItems(items.filter((_, i) => i !== index))} aria-label={`Remove correction ${index + 1}`}>Remove</button>
        </li>)}</ol>
        <button type="button" disabled={locked || items.length >= 30} onClick={() => setItems([...items, { correction: "", reference: "" }])}>Add correction</button>
    </section>;
}
