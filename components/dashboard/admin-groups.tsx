"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeResearchGroupStatusAction } from "@/lib/actions/research-group.action";
import AdminMutationDialog from "./admin-mutation-dialog";
import styles from "./admin-management.module.css";
import shared from "./student-ui.module.css";

export type AdminDirectoryGroup = { id: number; groupName: string; strand: string; section: string; schoolYear: string; adviserId: number; status: string };
const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

export default function AdminGroups({ groups }: { groups: AdminDirectoryGroup[] }) {
    const router = useRouter();
    const [refreshing, startRefresh] = useTransition();
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [selected, setSelected] = useState<AdminDirectoryGroup | null>(null);
    const [notice, setNotice] = useState("");
    const [verify, setVerify] = useState(false);
    const active = groups.filter(group => group.status === "active").length;
    const archived = groups.filter(group => group.status === "archived").length;
    const other = groups.length - active - archived;
    const filtered = groups.filter(group => (!status || group.status === status) && [group.groupName, group.strand, group.section].some(value => normalize(value).includes(normalize(search))));
    const action = selected?.status === "active" ? "Archive" : "Reactivate";
    return <>
        <p className="dashboard-context">Monitor and manage registered research groups.</p>
        <dl className={styles.metrics} aria-label="Research group summary">{[["Total Groups", groups.length], ["Active Groups", active], ["Archived Groups", archived]].map(([label, count]) => <div className="dashboard-panel" key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
        {other > 0 && <p className="form-message" role="status">{other} groups have other recorded statuses. They are included in Total Groups and All Groups; status actions are unavailable for them.</p>}
        <p role="status" className={notice || refreshing ? "research-notice" : undefined}>{refreshing ? "Updating research groups..." : notice}</p>
        {verify && <p role="alert" className="form-message">Changes are paused until you refresh and verify group status. <button onClick={() => window.location.reload()}>Refresh and verify</button></p>}
        <section className={`dashboard-panel ${styles.directory}`} aria-labelledby="groups-heading" aria-busy={refreshing}>
            <h2 id="groups-heading">Registered Groups</h2>
            <div className={styles.filters}>
                <label>Search groups<input type="search" placeholder="Group name, strand or section" value={search} onChange={event => setSearch(event.target.value)} /></label>
                <label>Group status<select aria-label="Group status" value={status} onChange={event => setStatus(event.target.value)}><option value="">All Groups</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
            </div>
            {(search || status) && <button className={shared.toggle} onClick={() => { setSearch(""); setStatus(""); }}>Clear filters</button>}
            {!groups.length ? <p className={styles.empty}>No registered research groups.</p> : !filtered.length ? <p className={styles.empty}>No groups match your search and filters. Try another search or clear the filters.</p> : <ul className={styles.list}>{filtered.map(group => <li key={group.id} className={styles.row}>
                <div className={styles.identity}><h3>{group.groupName}</h3><p className={styles.metadata}>Strand: {group.strand} · Section: {group.section} · School year: {group.schoolYear}</p><p className={styles.metadata}>Adviser ID: {group.adviserId}</p></div>
                <div className={styles.actions}><span className={styles.status}>{group.status === "active" ? "Active" : group.status === "archived" ? "Archived" : group.status || "Unknown"}</span>
                    {["active", "archived"].includes(group.status) && <button disabled={refreshing || verify} aria-label={`${group.status === "active" ? "Archive" : "Reactivate"} ${group.groupName}`} onClick={() => setSelected(group)}>{group.status === "active" ? "Archive" : "Reactivate"}</button>}
                </div>
            </li>)}</ul>}
        </section>
        {selected && <AdminMutationDialog title={`${action} ${selected.groupName}?`} label={action}
            explanation={`${action} the research group "${selected.groupName}"? Its recorded status will change to ${selected.status === "active" ? "archived" : "active"}.`}
            action={() => changeResearchGroupStatusAction(selected.id, selected.status === "active" ? "archived" : "active")}
            onClose={() => setSelected(null)} onUncertain={() => setVerify(true)} onComplete={message => { setSelected(null); setNotice(message); startRefresh(() => router.refresh()); }} />}
    </>;
}
