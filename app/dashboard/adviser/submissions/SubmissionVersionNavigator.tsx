"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";
import { submissionDetailsHref } from "@/lib/utils/adviser-submissions";
import { useReviewDraft } from "./ReviewDraftBoundary";
import styles from "./review-workspace.module.css";

export type SubmissionVersionOption = { id: number; version: string; status: string };

export default function SubmissionVersionNavigator({ submissionId, versions }: { submissionId: number; versions: SubmissionVersionOption[] }) {
    const id = useId();
    const router = useRouter();
    const draft = useReviewDraft();
    return <nav className={styles.versions} aria-label="Submission versions">
        <label htmlFor={id}>Submission version</label>
        <select id={id} value={submissionId} onChange={event => {
            const selected = versions.find(version => version.id === Number(event.target.value));
            if (selected && selected.id !== submissionId && (!draft || draft.confirmLeave())) router.push(submissionDetailsHref(selected.id));
        }}>
            {versions.map(version => <option key={version.id} value={version.id}>{version.version} · {version.status}</option>)}
        </select>
    </nav>;
}
