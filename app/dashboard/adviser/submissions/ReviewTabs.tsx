"use client";
import { useId, useState } from "react";
import MainDelegationPanel from "@/components/dashboard/main-delegation-panel";
import RevisionChecklist from "@/components/dashboard/revision-checklist";
import { RevisionDraftEditor } from "./RevisionDraft";
import styles from "@/components/dashboard/revisions.module.css";

const labels = ["Review", "Revisions", "Co-Adviser"];
export default function ReviewTabs({ submissionId, paperId, editable, children }: { submissionId: number; paperId: number; editable: boolean; children: React.ReactNode }) {
    const [selected, setSelected] = useState(0);
    const [visited, setVisited] = useState(labels.map((_, index) => index === 0));
    const id = useId();
    function select(index: number) { setSelected(index); setVisited(previous => previous.map((value, i) => value || i === index)); }
    return <>
        <div role="tablist" aria-label="Submission review" className={styles.tabs}>
            {labels.map((label, index) => <button key={label} id={`${id}-tab-${index}`} type="button" role="tab" aria-selected={selected === index}
                aria-controls={`${id}-panel-${index}`} tabIndex={selected === index ? 0 : -1} onClick={() => select(index)} onKeyDown={event => {
                    const next = event.key === "ArrowRight" ? (index + 1) % labels.length : event.key === "ArrowLeft" ? (index + labels.length - 1) % labels.length : event.key === "Home" ? 0 : event.key === "End" ? labels.length - 1 : null;
                    if (next === null) return;
                    event.preventDefault(); select(next); document.getElementById(`${id}-tab-${next}`)?.focus();
                }}>{label}</button>)}
        </div>
        <div id={`${id}-panel-0`} role="tabpanel" aria-labelledby={`${id}-tab-0`} hidden={selected !== 0} tabIndex={0}>{children}</div>
        <div id={`${id}-panel-1`} role="tabpanel" aria-labelledby={`${id}-tab-1`} hidden={selected !== 1} tabIndex={0}>
            {editable ? <RevisionDraftEditor /> : visited[1] && <RevisionChecklist paperId={paperId} submissionId={submissionId} />}
        </div>
        <div id={`${id}-panel-2`} role="tabpanel" aria-labelledby={`${id}-tab-2`} hidden={selected !== 2} tabIndex={0}>
            {visited[2] && <MainDelegationPanel submissionId={submissionId} />}
        </div>
    </>;
}
