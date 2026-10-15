"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ResearchDialog from "./research-dialog";
import { createResearchGroupAction } from "@/lib/actions/research-group.action";
import { addGroupMemberAction, eligibleGroupStudentsAction, removeGroupMemberAction } from "@/lib/actions/group-member.action";
import type { readAdviserGroups, readEligibleGroupStudents } from "@/lib/repositories/adviser-groups.repository";
import styles from "./adviser-groups.module.css";
import shared from "./student-ui.module.css";

type Group = Awaited<ReturnType<typeof readAdviserGroups>>[number];
type Student = Awaited<ReturnType<typeof readEligibleGroupStudents>>[number];
const name = (student: { firstName: string; lastName: string }) => `${student.firstName} ${student.lastName}`.trim() || "Unnamed student";
const value = (text: string) => text.trim() || "Not provided";

export default function AdviserGroups({ groups }: { groups: Group[] }) {
    const router = useRouter();
    const [refreshing, startRefresh] = useTransition();
    const refresh = () => startRefresh(() => router.refresh());
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState<number | null>(null);
    const [creating, setCreating] = useState(false);
    const [managing, setManaging] = useState<number | null>(null);
    const [notice, setNotice] = useState("");
    const query = search.trim().replace(/\s+/g, " ").toLocaleLowerCase();
    const filtered = groups.filter(group => [group.groupName, group.strand, group.section].some(text => text.replace(/\s+/g, " ").toLocaleLowerCase().includes(query)));
    const selected = groups.find(group => group.id === managing);
    const metrics = [
        ["Total Groups", groups.length],
        ["Assigned Students", new Set(groups.flatMap(group => group.members.map(member => member.userId))).size],
        ["Groups Without Members", groups.filter(group => !group.members.length).length],
    ];
    return <>
        <div className={styles.toolbar}><p className="dashboard-context">Create and manage your research groups.</p><button onClick={() => setCreating(true)}>New Group</button></div>
        <dl className={styles.metrics} aria-label="Research group summary">{metrics.map(([label, count]) => <div className="dashboard-panel" key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
        <p role="status" className={notice || refreshing ? "research-notice" : undefined}>{refreshing ? "Updating research groups..." : notice}</p>
        <section className={`dashboard-panel ${styles.directory}`} aria-labelledby="directory-heading">
            <h2 id="directory-heading">My Research Groups</h2>
            <label htmlFor="group-search">Search groups</label>
            <input id="group-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Group name, strand or section" />
            {search && <button className={shared.toggle} onClick={() => setSearch("")}>Clear search</button>}
            {!groups.length ? <p className={styles.empty}>You have no research groups yet. Select New Group to create one.</p> : !filtered.length ? <p className={styles.empty}>No Matching Groups. Try another group name, strand or section, or clear your search.</p> : <ul className={styles.groups}>{filtered.map(group => <li key={group.id}>
                <h3><button className={styles.row} id={`group-toggle-${group.id}`} aria-expanded={expanded === group.id} aria-controls={`group-details-${group.id}`} onClick={() => setExpanded(expanded === group.id ? null : group.id)}>
                    <span className={styles.summary}><strong>{value(group.groupName)}</strong><span className={styles.metadata}>Strand: {value(group.strand)} · Section: {value(group.section)} · School year: {value(group.schoolYear)}</span><span className={styles.metadata}>{group.members.length} {group.members.length === 1 ? "member" : "members"} · {group.projects.length} {group.projects.length === 1 ? "research project" : "research projects"}</span></span>
                    <span className={styles.disclosure}>{expanded === group.id ? "Hide" : "Details"}</span>
                </button></h3>
                <div id={`group-details-${group.id}`} role="region" aria-labelledby={`group-toggle-${group.id}`} hidden={expanded !== group.id} className={styles.details}>
                    <p>Status: {value(group.status)}</p>
                    <div className={styles.detailHeader}><h4>Current Members ({group.members.length})</h4><button disabled={refreshing} onClick={() => setManaging(group.id)}>Manage Members</button></div>
                    {!group.members.length ? <p>No students are currently assigned to this group.</p> : <ul className={styles.members}>{group.members.map(member => <li key={member.id}><strong>{name(member)}</strong><span className="form-help">{member.email}</span></li>)}</ul>}
                    <h4>Research Projects ({group.projects.length})</h4>
                    {!group.projects.length ? <p>This group has no research projects yet.</p> : <ul className={styles.projects}>{group.projects.map(project => <li key={project.id}><strong>{value(project.title)}</strong><span className="form-help">{value(project.status)}</span></li>)}</ul>}
                </div>
            </li>)}</ul>}
        </section>
        {creating && <ResearchDialog title="Create Research Group" submitLabel="Create Research Group" showCancel action={createResearchGroupAction} onClose={() => setCreating(false)} onSuccess={() => { setCreating(false); setNotice("Research group created successfully."); refresh(); }}>
            {([{ key: "groupName", label: "Group Name", max: 100 }, { key: "strand", label: "Strand", max: 50 }, { key: "section", label: "Section", max: 50 }, { key: "schoolYear", label: "School Year", max: 20 }]).map(field => <div key={field.key}><label htmlFor={`new-${field.key}`}>{field.label}</label><input id={`new-${field.key}`} name={field.key} required maxLength={field.max} /></div>)}
        </ResearchDialog>}
        {selected && <ManageMembers key={selected.id} group={selected} refreshing={refreshing} refresh={refresh} onClose={() => setManaging(null)} />}
    </>;
}

function ManageMembers({ group, onClose, refreshing, refresh }: { group: Group; onClose: () => void; refreshing: boolean; refresh: () => void }) {
    const [students, setStudents] = useState<Student[] | null>(null);
    const [loadError, setLoadError] = useState("");
    const [studentId, setStudentId] = useState("");
    const [removing, setRemoving] = useState<Group["members"][number] | null>(null);
    const [notice, setNotice] = useState("");
    const confirmation = useRef<HTMLParagraphElement>(null);
    const [revision, setRevision] = useState(0);
    useEffect(() => { if (removing) confirmation.current?.focus(); }, [removing]);
    useEffect(() => {
        let current = true;
        eligibleGroupStudentsAction(group.id).then(result => {
            if (!current) return;
            if (result.success && result.data) setStudents(result.data);
            else setLoadError(result.message);
        }).catch(() => { if (current) setLoadError("Students could not be retrieved. Close this dialog and try again."); });
        return () => { current = false; };
    }, [group.id, revision]);
    return <ResearchDialog title={`Manage Members: ${value(group.groupName)}`} submitLabel={removing ? "Remove" : "Add Student"} showCancel busy={refreshing}
        submitDisabled={!removing && (group.status !== "active" || !studentId || !students || !!loadError)} onClose={onClose}
        action={async () => removing ? removeGroupMemberAction(group.id, removing.userId) : addGroupMemberAction(group.id, Number(studentId))}
        onSuccess={() => { setNotice(removing ? `${name(removing)} removed from ${group.groupName}.` : `Student added to ${group.groupName}.`); setRemoving(null); setStudentId(""); setStudents(null); setLoadError(""); setRevision(current => current + 1); refresh(); }}>
        <p role="status" className={notice || refreshing ? "research-notice" : undefined}>{refreshing ? "Updating members..." : notice}</p>
        {removing ? <>
            <p ref={confirmation} tabIndex={-1}>Remove <strong>{name(removing)}</strong> from <strong>{group.groupName}</strong>?</p>
            <button type="button" className={shared.toggle} onClick={() => { const id = removing.userId; setRemoving(null); requestAnimationFrame(() => document.getElementById(`remove-member-${id}`)?.focus()); }}>Cancel removal</button>
        </> : <>
            <h3>Current Members ({group.members.length})</h3>
            {!group.members.length ? <p>No students are currently assigned to this group.</p> : <ul className={styles.members}>{group.members.map(member => <li key={member.id}><div><strong>{name(member)}</strong><span className="form-help">{member.email}</span></div><button id={`remove-member-${member.userId}`} type="button" className={shared.toggle} aria-label={`Remove ${name(member)}`} onClick={() => setRemoving(member)}>Remove</button></li>)}</ul>}
            <div><label htmlFor="assign-student">Add Student</label>
                {group.status !== "active" ? <p>Students can only be added to active research groups.</p> : loadError ? <p role="alert">{loadError}</p> : students === null ? <p role="status">Loading eligible students...</p> : !students.length ? <p>No eligible students are available to assign.</p> : <select id="assign-student" value={studentId} onChange={event => setStudentId(event.target.value)} required><option value="">Select a student</option>{students.map(student => <option key={student.id} value={student.id}>{name(student)} ({student.email})</option>)}</select>}
            </div>
        </>}
    </ResearchDialog>;
}
