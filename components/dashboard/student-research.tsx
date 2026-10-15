"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StudentWorkspace } from "@/lib/services/student-workspace.service";
import { resolveResearchTarget, type ResearchTarget } from "@/lib/student-research-view";
import { createStudentResearchAction } from "@/lib/actions/student-research.action";
import { submitResearchAction } from "@/lib/actions/submission.action";
import DownloadSubmissionButton from "@/app/dashboard/student/submissions/DownloadSubmissionButton";
import ResearchDialog from "./research-dialog";
import styles from "./student-ui.module.css";

export default function StudentResearch({ workspace, target }: { workspace: StudentWorkspace; target: ResearchTarget }) {
    const [notice, setNotice] = useState("");
    return <StudentResearchContent key={JSON.stringify([target.project, target.submission, target.feedback])} workspace={workspace} target={target} notice={notice} setNotice={setNotice} />;
}

function StudentResearchContent({ workspace, target, notice, setNotice }: {
    workspace: StudentWorkspace; target: ResearchTarget; notice: string; setNotice: (message: string) => void;
}) {
    const router = useRouter();
    const initial = resolveResearchTarget(workspace, target);
    const [selectedId, setSelectedId] = useState(initial.project?.id);
    const [expanded, setExpanded] = useState<number | null>(initial.expandedId);
    const [details, setDetails] = useState(false);
    const [modal, setModal] = useState<"create" | "upload" | null>(null);
    const highlighted = useRef<HTMLDivElement>(null);
    const project = workspace.projects.find(item => item.id === selectedId);
    const history = resolveResearchTarget(workspace, { project: String(selectedId), submission: undefined, feedback: undefined }).submissions;
    useEffect(() => {
        if (initial.feedbackId) { highlighted.current?.scrollIntoView({ block: "center" }); highlighted.current?.focus({ preventScroll: true }); }
    }, [initial.feedbackId]);
    function success(projectId?: number) {
        const creating = modal === "create";
        setModal(null); setNotice(creating ? "Research project created successfully." : "Research submitted successfully.");
        if (creating && projectId) router.replace(`/dashboard/student/submissions?project=${projectId}`);
        else router.refresh();
    }
    return <>
        <div className={styles.toolbar}>
            {workspace.projects.length > 0 && <div className={styles.selector}><label htmlFor="research-project">Research project</label>
                <select id="research-project" value={selectedId} disabled={modal !== null} onChange={event => {
                    const id = Number(event.target.value);
                    setSelectedId(id); setDetails(false); setNotice("");
                    setExpanded(resolveResearchTarget(workspace, { project: String(id), submission: undefined, feedback: undefined }).expandedId);
                }}>{workspace.projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>}
            {workspace.groups.length > 0 && <button type="button" onClick={() => setModal("create")}>Create Project</button>}
        </div>
        <p role="status">{notice}</p>
        <section className={`dashboard-panel ${styles.section}`} aria-labelledby="project-heading"><h2 id="project-heading">Research Project Details</h2>
            {project ? <><div className={styles.projectSummary}><h3>{project.title}</h3>{project.category && <p>{project.category}</p>}<p><span className={styles.badge}>{project.status}</span></p>
                <button type="button" className={styles.toggle} aria-expanded={details} aria-controls="project-description" onClick={() => setDetails(!details)}>{details ? "Hide Details" : "View Details"}</button>
                </div>
                <div id="project-description" className={styles.details} hidden={!details}><h4>Abstract</h4><p>{project.abstract}</p><h4>Keywords</h4><p>{project.keywords || "Not specified"}</p></div>
            </> : <p>{selectedId ? "Loading the created research project…" : workspace.groups.length ? "No research projects yet. Create a project after your title proposal has been accepted." : "Your Adviser must assign you to a research group before you can create a project."}</p>}
        </section>
        <section className={`dashboard-panel ${styles.section}`} aria-labelledby="history-heading">
            <div className={styles.toolbar}><h2 id="history-heading">Submission History</h2>{project && <button type="button" onClick={() => setModal("upload")}>Submit PDF</button>}</div>
            {!history.length ? <p>{project ? "Not yet submitted. Submit a PDF for this project’s first version." : "Submission versions will appear here after you create a project and submit a PDF."}</p> :
                <ol className={styles.history}>{history.map(submission => <li key={submission.id}>
                    <h3><button type="button" className={styles.row} aria-expanded={expanded === submission.id} aria-controls={`version-${submission.id}`} onClick={() => setExpanded(expanded === submission.id ? null : submission.id)}>
                        <span>{submission.version}</span><time dateTime={submission.submittedAt}>{new Date(submission.submittedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</time><span className={styles.badge}>{submission.status}</span><span>{expanded === submission.id ? "Hide" : "View"}</span>
                    </button></h3>
                    <div id={`version-${submission.id}`} hidden={expanded !== submission.id} className={styles.body}>
                        <h4>Submission remarks</h4><p className="research-comments">{submission.remarks || "No remarks provided."}</p>
                        <DownloadSubmissionButton submissionId={submission.id} />
                        <h4>Adviser Feedback · {submission.version}</h4>
                        {submission.feedbackUnavailable ? <p role="alert">Feedback could not be retrieved. Reload to try again.</p> : submission.feedbackRestricted ? <p>Feedback for this version is available to the Student who submitted it.</p> : !submission.feedback.length ? <p>No feedback recorded for this version yet.</p> : submission.feedback.map(item => <div id={`feedback-${item.id}`} key={item.id} tabIndex={item.id === initial.feedbackId ? -1 : undefined} ref={item.id === initial.feedbackId ? highlighted : undefined} className={`${styles.feedbackEntry} ${item.id === initial.feedbackId ? styles.target : "feedback-entry"}`}>
                            <p><strong>Decision: {item.decision}</strong></p><p className="research-comments">{item.comments}</p><p className="form-help">Reviewed <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</time></p>
                        </div>)}
                    </div>
                </li>)}</ol>}
        </section>
        {modal === "create" && <ResearchDialog title="Create Research Project" submitLabel="Create Research Project" action={createStudentResearchAction} onSuccess={success} onClose={() => setModal(null)}>
            <p className="form-help">Create a project after your title proposal has been accepted. Group, title and abstract are required.</p>
            <div><label htmlFor="groupId">Research Group</label><select id="groupId" name="groupId" required defaultValue={workspace.groups[0]?.id}>{workspace.groups.map(group => <option key={group.id} value={group.id}>{group.groupName}</option>)}</select></div>
            <div><label htmlFor="title">Research Title</label><input id="title" name="title" required maxLength={200} /></div>
            <div><label htmlFor="abstract">Abstract</label><textarea id="abstract" name="abstract" rows={6} required /></div>
            <div><label htmlFor="category">Category (optional)</label><input id="category" name="category" maxLength={100} /></div>
            <div><label htmlFor="keywords">Keywords (optional)</label><input id="keywords" name="keywords" maxLength={500} /></div>
        </ResearchDialog>}
        {modal === "upload" && project && <ResearchDialog title="Submit Research PDF" submitLabel="Submit Research PDF" action={submitResearchAction} onSuccess={success} onClose={() => setModal(null)}>
            <p><strong>Research project:</strong> {project.title}</p><input type="hidden" name="paperId" value={project.id} />
            <p className="form-help">Submit a revised version only after the latest version is marked Revision Required.</p>
            <div><label htmlFor="file">Research PDF</label><input id="file" name="file" type="file" accept="application/pdf,.pdf" required aria-describedby="file-requirements" /><p id="file-requirements" className="form-help">PDF files only. Maximum file size: 10 MB.</p></div>
            <div><label htmlFor="remarks">Remarks (optional)</label><textarea id="remarks" name="remarks" rows={4} maxLength={500} /></div>
        </ResearchDialog>}
    </>;
}
