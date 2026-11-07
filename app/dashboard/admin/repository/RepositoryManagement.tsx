"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishRepositoryPaperAction, updateRepositoryPublicationAction } from "@/lib/actions/repository.action";
import type { getRepositoryManagementData } from "@/lib/services/repository.service";
import AdminMutationDialog from "@/components/dashboard/admin-mutation-dialog";
import { useDisplayMode, usePwaPlatform } from "@/lib/pwa/use-display-mode";
import styles from "@/components/dashboard/admin-management.module.css";
import workspace from "./publication-workspace.module.css";

type Data = NonNullable<Awaited<ReturnType<typeof getRepositoryManagementData>>>;
type Selection = { kind: "publish" | "unpublish" | "republish"; id: number; title: string };
type Inspection = { view: "ready" | "entries"; id: number };
const date = (value: Date | string) => new Date(value).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric" });

export default function RepositoryManagement({ eligiblePapers, repositoryEntries }: Data) {
    const router = useRouter();
    const displayMode = useDisplayMode();
    const platform = usePwaPlatform();
    const desktop = displayMode === "standalone" && platform === "desktop";
    const directoryHeading = useRef<HTMLHeadingElement>(null);
    const [refreshing, startRefresh] = useTransition();
    const [view, setView] = useState<"ready" | "entries">("ready");
    const [visibility, setVisibility] = useState("");
    const [selected, setSelected] = useState<Selection | null>(null);
    const [inspected, setInspected] = useState<Inspection | null>(null);
    const [notice, setNotice] = useState("");
    const [verify, setVerify] = useState(false);
    const published = repositoryEntries.filter(entry => entry.isPublished).length;
    const entries = repositoryEntries.filter(entry => !visibility || entry.isPublished === (visibility === "published"));
    // Resolve inspection from current, visible props; never retain a stale record snapshot.
    const readyPaper = inspected?.view === view && view === "ready" ? eligiblePapers.find(paper => paper.paperId === inspected.id) : undefined;
    const entry = inspected?.view === view && view === "entries" ? entries.find(item => item.id === inspected.id) : undefined;
    const detail = readyPaper ? { title: readyPaper.title, groupName: readyPaper.groupName, date: readyPaper.createdAt, dateLabel: "Created", status: "Ready", kind: "publish" as const, id: readyPaper.paperId }
        : entry ? { title: entry.title, groupName: entry.groupName, date: entry.publishedAt, dateLabel: "Published", status: entry.isPublished ? "Published" : "Hidden", kind: entry.isPublished ? "unpublish" as const : "republish" as const, id: entry.id } : null;
    const detailAction = detail?.kind === "unpublish" ? "Unpublish" : detail?.kind === "republish" ? "Republish" : "Publish";
    const label = selected?.kind === "unpublish" ? "Unpublish" : selected?.kind === "republish" ? "Republish" : "Publish";
    return <>
        <p className="dashboard-context">Manage approved research publication and repository visibility.</p>
        <dl className={`${styles.metrics} dashboard-metrics`} aria-label="Repository management summary">{[["Ready to Publish", eligiblePapers.length], ["Published", published], ["Hidden", repositoryEntries.length - published]].map(([title, count]) => <div className="dashboard-panel" key={title}><dt>{title}</dt><dd>{count}</dd></div>)}</dl>
        <p role="status" className={notice || refreshing ? "research-notice" : undefined}>{refreshing ? "Updating repository management..." : notice}</p>
        {verify && <p role="alert" className="form-message">Changes are paused until you refresh and verify repository visibility. <button onClick={() => window.location.reload()}>Refresh and verify</button></p>}
        <div role="group" aria-label="Repository views" className={styles.views}>
            <button aria-pressed={view === "ready"} aria-controls="repository-directory" onClick={() => { setView("ready"); setInspected(null); }}>Ready to Publish</button>
            <button aria-pressed={view === "entries"} aria-controls="repository-directory" onClick={() => { setView("entries"); setInspected(null); }}>Repository Entries</button>
        </div>
        <div className={desktop ? workspace.container : undefined}>
        <div className={desktop ? workspace.workspace : undefined}>
        <section id="repository-directory" className={`dashboard-panel ${styles.directory}`} aria-labelledby="repository-directory-heading" aria-busy={refreshing}>
            <h2 ref={directoryHeading} tabIndex={desktop ? -1 : undefined} id="repository-directory-heading">{view === "ready" ? "Ready to Publish" : "Repository Entries"}</h2>
            {view === "ready" ? !eligiblePapers.length ? <p className={styles.empty}>No eligible research is ready to publish.</p> : <ul className={styles.list}>{eligiblePapers.map(paper => <li key={paper.paperId} className={`${styles.row} ${desktop && readyPaper?.paperId === paper.paperId ? workspace.selected : ""}`}>
                <div className={styles.identity}><h3>{paper.title}</h3><p className={styles.metadata}>{paper.groupName}</p>{paper.createdAt && <p className={styles.metadata}>Created: <time dateTime={new Date(paper.createdAt).toISOString()}>{date(paper.createdAt)}</time></p>}</div>
                {desktop ? <button className={workspace.inspect} aria-label={`Inspect ${paper.title}`} aria-pressed={readyPaper?.paperId === paper.paperId} aria-controls="publication-details" onClick={() => setInspected({ view: "ready", id: paper.paperId })}>Inspect</button>
                    : <button disabled={refreshing || verify} aria-label={`Publish ${paper.title}`} onClick={() => setSelected({ kind: "publish", id: paper.paperId, title: paper.title })}>Publish</button>}
            </li>)}</ul> : <>
                <label className={styles.visibility}>Repository visibility<select aria-label="Repository visibility" value={visibility} onChange={event => { setVisibility(event.target.value); setInspected(null); }}><option value="">All Entries</option><option value="published">Published</option><option value="hidden">Hidden</option></select></label>
                {!repositoryEntries.length ? <p className={styles.empty}>No repository entries have been created.</p> : !entries.length ? <p className={styles.empty}>No {visibility === "published" ? "Published" : "Hidden"} entries.</p> : <ul className={styles.list}>{entries.map(entry => <li key={entry.id} className={`${styles.row} ${desktop && inspected?.view === "entries" && inspected.id === entry.id ? workspace.selected : ""}`}>
                    <div className={styles.identity}><h3>{entry.title}</h3><p className={styles.metadata}>{entry.groupName}</p>{entry.publishedAt && <p className={styles.metadata}>Published: <time dateTime={new Date(entry.publishedAt).toISOString()}>{date(entry.publishedAt)}</time></p>}</div>
                    <div className={styles.actions}><span className={styles.status}>{entry.isPublished ? "Published" : "Hidden"}</span>{desktop
                        ? <button className={workspace.inspect} aria-label={`Inspect ${entry.title}`} aria-pressed={inspected?.view === "entries" && inspected.id === entry.id} aria-controls="publication-details" onClick={() => setInspected({ view: "entries", id: entry.id })}>Inspect</button>
                        : <button disabled={refreshing || verify} aria-label={`${entry.isPublished ? "Unpublish" : "Republish"} ${entry.title}`} onClick={() => setSelected({ kind: entry.isPublished ? "unpublish" : "republish", id: entry.id, title: entry.title })}>{entry.isPublished ? "Unpublish" : "Republish"}</button>}</div>
                </li>)}</ul>}
            </>}
        </section>
        {desktop && <section id="publication-details" className={`dashboard-panel ${workspace.details}`} aria-labelledby="publication-details-heading" aria-busy={refreshing}>
            <h2 id="publication-details-heading">Publication details</h2>
            {detail ? <>
                <h3>{detail.title}</h3>
                <dl className={workspace.metadata}>
                    <div><dt>Research group</dt><dd>{detail.groupName}</dd></div>
                    <div><dt>Publication status</dt><dd>{detail.status}</dd></div>
                    {detail.date && <div><dt>{detail.dateLabel}</dt><dd><time dateTime={new Date(detail.date).toISOString()}>{date(detail.date)}</time></dd></div>}
                </dl>
                <p className={styles.metadata}>{detail.kind === "unpublish" ? "Unpublishing hides this entry from the repository. Previously issued document links may remain usable until they expire." : "Publication rechecks approval and private document availability."}</p>
                <button disabled={refreshing || verify} aria-label={`${detailAction} ${detail.title}`} onClick={() => setSelected({ kind: detail.kind, id: detail.id, title: detail.title })}>{detailAction}</button>
            </> : <p>{inspected ? "The selected research is no longer available in this view. Select another paper to inspect." : "Select Inspect beside a paper to view its publication details."}</p>}
        </section>}
        </div>
        </div>
        {selected && <AdminMutationDialog title={`${label} ${selected.title}${selected.kind === "publish" ? " to the repository" : ""}?`} label={label}
            explanation={selected.kind === "unpublish" ? "This entry will be Hidden in the repository. Previously issued document links may remain usable until they expire." : "This research will be visible in the repository if it still meets the existing approval and private document requirements."}
            action={async () => {
                const data = new FormData();
                if (selected.kind === "publish") { data.set("paperId", String(selected.id)); return publishRepositoryPaperAction({ success: false, message: "" }, data); }
                data.set("repositoryId", String(selected.id)); data.set("publish", String(selected.kind === "republish"));
                return updateRepositoryPublicationAction({ success: false, message: "" }, data);
            }} onClose={() => setSelected(null)} onUncertain={() => setVerify(true)} onComplete={message => {
                setSelected(null); setInspected(null); setNotice(message); startRefresh(() => router.refresh());
                // The detail action disappears when selection clears. Restore focus after dialog cleanup.
                if (desktop) requestAnimationFrame(() => directoryHeading.current?.focus());
            }} />}
    </>;
}
