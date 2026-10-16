"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishRepositoryPaperAction, updateRepositoryPublicationAction } from "@/lib/actions/repository.action";
import type { getRepositoryManagementData } from "@/lib/services/repository.service";
import AdminMutationDialog from "@/components/dashboard/admin-mutation-dialog";
import styles from "@/components/dashboard/admin-management.module.css";

type Data = NonNullable<Awaited<ReturnType<typeof getRepositoryManagementData>>>;
type Selection = { kind: "publish" | "unpublish" | "republish"; id: number; title: string };
const date = (value: Date | string) => new Date(value).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric" });

export default function RepositoryManagement({ eligiblePapers, repositoryEntries }: Data) {
    const router = useRouter();
    const [refreshing, startRefresh] = useTransition();
    const [view, setView] = useState<"ready" | "entries">("ready");
    const [visibility, setVisibility] = useState("");
    const [selected, setSelected] = useState<Selection | null>(null);
    const [notice, setNotice] = useState("");
    const [verify, setVerify] = useState(false);
    const published = repositoryEntries.filter(entry => entry.isPublished).length;
    const entries = repositoryEntries.filter(entry => !visibility || entry.isPublished === (visibility === "published"));
    const label = selected?.kind === "unpublish" ? "Unpublish" : selected?.kind === "republish" ? "Republish" : "Publish";
    return <>
        <p className="dashboard-context">Manage approved research publication and repository visibility.</p>
        <dl className={styles.metrics} aria-label="Repository management summary">{[["Ready to Publish", eligiblePapers.length], ["Published", published], ["Hidden", repositoryEntries.length - published]].map(([title, count]) => <div className="dashboard-panel" key={title}><dt>{title}</dt><dd>{count}</dd></div>)}</dl>
        <p role="status" className={notice || refreshing ? "research-notice" : undefined}>{refreshing ? "Updating repository management..." : notice}</p>
        {verify && <p role="alert" className="form-message">Changes are paused until you refresh and verify repository visibility. <button onClick={() => window.location.reload()}>Refresh and verify</button></p>}
        <div role="group" aria-label="Repository views" className={styles.views}>
            <button aria-pressed={view === "ready"} aria-controls="repository-directory" onClick={() => setView("ready")}>Ready to Publish</button>
            <button aria-pressed={view === "entries"} aria-controls="repository-directory" onClick={() => setView("entries")}>Repository Entries</button>
        </div>
        <section id="repository-directory" className={`dashboard-panel ${styles.directory}`} aria-labelledby="repository-directory-heading" aria-busy={refreshing}>
            <h2 id="repository-directory-heading">{view === "ready" ? "Ready to Publish" : "Repository Entries"}</h2>
            {view === "ready" ? !eligiblePapers.length ? <p className={styles.empty}>No eligible research is ready to publish.</p> : <ul className={styles.list}>{eligiblePapers.map(paper => <li key={paper.paperId} className={styles.row}>
                <div className={styles.identity}><h3>{paper.title}</h3><p className={styles.metadata}>{paper.groupName}</p>{paper.createdAt && <p className={styles.metadata}>Created: <time dateTime={new Date(paper.createdAt).toISOString()}>{date(paper.createdAt)}</time></p>}</div>
                <button disabled={refreshing || verify} aria-label={`Publish ${paper.title}`} onClick={() => setSelected({ kind: "publish", id: paper.paperId, title: paper.title })}>Publish</button>
            </li>)}</ul> : <>
                <label className={styles.visibility}>Repository visibility<select aria-label="Repository visibility" value={visibility} onChange={event => setVisibility(event.target.value)}><option value="">All Entries</option><option value="published">Published</option><option value="hidden">Hidden</option></select></label>
                {!repositoryEntries.length ? <p className={styles.empty}>No repository entries have been created.</p> : !entries.length ? <p className={styles.empty}>No {visibility === "published" ? "Published" : "Hidden"} entries.</p> : <ul className={styles.list}>{entries.map(entry => <li key={entry.id} className={styles.row}>
                    <div className={styles.identity}><h3>{entry.title}</h3><p className={styles.metadata}>{entry.groupName}</p>{entry.publishedAt && <p className={styles.metadata}>Published: <time dateTime={new Date(entry.publishedAt).toISOString()}>{date(entry.publishedAt)}</time></p>}</div>
                    <div className={styles.actions}><span className={styles.status}>{entry.isPublished ? "Published" : "Hidden"}</span><button disabled={refreshing || verify} aria-label={`${entry.isPublished ? "Unpublish" : "Republish"} ${entry.title}`} onClick={() => setSelected({ kind: entry.isPublished ? "unpublish" : "republish", id: entry.id, title: entry.title })}>{entry.isPublished ? "Unpublish" : "Republish"}</button></div>
                </li>)}</ul>}
            </>}
        </section>
        {selected && <AdminMutationDialog title={`${label} ${selected.title}${selected.kind === "publish" ? " to the repository" : ""}?`} label={label}
            explanation={selected.kind === "unpublish" ? "This entry will be Hidden in the repository. Previously issued document links may remain usable until they expire." : "This research will be visible in the repository if it still meets the existing approval and private document requirements."}
            action={async () => {
                const data = new FormData();
                if (selected.kind === "publish") { data.set("paperId", String(selected.id)); return publishRepositoryPaperAction({ success: false, message: "" }, data); }
                data.set("repositoryId", String(selected.id)); data.set("publish", String(selected.kind === "republish"));
                return updateRepositoryPublicationAction({ success: false, message: "" }, data);
            }} onClose={() => setSelected(null)} onUncertain={() => setVerify(true)} onComplete={message => { setSelected(null); setNotice(message); startRefresh(() => router.refresh()); }} />}
    </>;
}
