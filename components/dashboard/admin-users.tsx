"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeUserRoleAction, changeUserStatusAction } from "@/lib/actions/user.action";
import ResearchDialog from "./research-dialog";
import AdminAccountCreation from "./admin-account-creation";
import { EligibilityDialog } from "./ai-governance-dialogs";
import styles from "./admin-users.module.css";
import shared from "./student-ui.module.css";

export type DirectoryUser = { id: number; firstName: string; lastName: string; email: string; roleId: number; isActive: boolean; createdAt: string; emailVerification: "Verified" | "Unverified" | "Not applicable" };
const roles = [[1, "Admin"], [2, "Adviser"], [3, "Student"], [4, "Panel"]] as const;
const roleName = (id: number) => roles.find(role => role[0] === id)?.[1] ?? "Unknown role";
const name = (user: DirectoryUser) => `${user.firstName} ${user.lastName}`.trim() || "Unnamed user";
const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

export default function AdminUsers({ users, actorId }: { users: DirectoryUser[]; actorId: number }) {
    const router = useRouter();
    const [refreshing, startRefresh] = useTransition();
    const refresh = () => startRefresh(() => router.refresh());
    const [search, setSearch] = useState("");
    const [role, setRole] = useState("");
    const [status, setStatus] = useState("");
    const [notice, setNotice] = useState("");
    const [modal, setModal] = useState<{ kind: "create" } | { kind: "manage" | "eligibility"; id: number; created?: boolean } | null>(null);
    const opener = useRef<HTMLElement | null>(null);
    const selected = modal && "id" in modal ? users.find(user => user.id === modal.id) : undefined;
    const filtered = users.filter(user => (!role || user.roleId === Number(role)) && (!status || user.isActive === (status === "active")) && [name(user), user.email].some(value => normalize(value).includes(normalize(search))));
    function close() { setModal(null); requestAnimationFrame(() => { if (opener.current?.isConnected) opener.current.focus(); else document.getElementById("new-account")?.focus(); }); }
    return <>
        <div className={styles.toolbar}><p className="dashboard-context">Manage registered users and account access.</p><button id="new-account" disabled={refreshing} onClick={event => { opener.current = event.currentTarget; setModal({ kind: "create" }); }}>New Account</button></div>
        <p role="status" className={notice || refreshing ? "research-notice" : undefined}>{refreshing ? "Updating registered users..." : notice}</p>
        <section className={`dashboard-panel ${styles.directory}`} aria-labelledby="users-heading" aria-busy={refreshing}>
            <h2 id="users-heading">Registered Users</h2>
            <div className={styles.filters}>
                <label>Search users<input type="search" placeholder="Name or email" value={search} onChange={event => setSearch(event.target.value)} /></label>
                <label>Role filter<select value={role} onChange={event => setRole(event.target.value)}><option value="">All roles</option>{roles.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
                <label>Status filter<select value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            </div>
            {(search || role || status) && <button className={shared.toggle} onClick={() => { setSearch(""); setRole(""); setStatus(""); }}>Clear filters</button>}
            {!users.length ? <p className={styles.empty}>No registered users.</p> : !filtered.length ? <p className={styles.empty}>No users match your search and filters. Try another name or email, or clear the filters.</p> : <ul className={styles.list}>{filtered.map(user => <li key={user.id} className={styles.row}>
                <div className={styles.identity}><h3>{name(user)}</h3><p className={styles.email}>{user.email}</p><p className={styles.metadata}>{roleName(user.roleId)} · {user.isActive ? "Active" : "Inactive"} · Created <time dateTime={user.createdAt}>{new Date(user.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" })}</time></p>
                    <p className={styles.metadata}>Email verification: {user.emailVerification}</p>
                </div>
                <button id={`manage-user-${user.id}`} className={shared.toggle} disabled={refreshing} aria-label={`Manage ${name(user)} (${user.email})`} onClick={event => { opener.current = event.currentTarget; setModal({ kind: "manage", id: user.id }); }}>Manage</button>
            </li>)}</ul>}
        </section>
        {modal?.kind === "create" && <AdminAccountCreation onClose={close} onCreated={id => { setModal({ kind: "eligibility", id, created: true }); setNotice("Account created. AI eligibility is Pending Verification."); refresh(); }} />}
        {modal?.kind === "manage" && selected && <ManageUser key={selected.id} user={selected} self={selected.id === actorId} onClose={close} onEligibility={() => setModal({ kind: "eligibility", id: selected.id })} onUpdated={message => { close(); setNotice(message); refresh(); }} onRefresh={() => { close(); refresh(); }} />}
        {modal?.kind === "eligibility" && <EligibilityDialog key={modal.id} userId={modal.id} userName={selected ? name(selected) : undefined} initiallyOpen onClose={close} />}
    </>;
}

function ManageUser({ user, self, onClose, onEligibility, onUpdated, onRefresh }: { user: DirectoryUser; self: boolean; onClose: () => void; onEligibility: () => void; onUpdated: (message: string) => void; onRefresh: () => void }) {
    const [role, setRole] = useState(user.roleId);
    const [confirmation, setConfirmation] = useState<"role" | "status" | null>(null);
    const [uncertain, setUncertain] = useState(false);
    const resultMessage = useRef("");
    const confirmRef = useRef<HTMLParagraphElement>(null);
    function confirm(kind: "role" | "status") { setConfirmation(kind); requestAnimationFrame(() => confirmRef.current?.focus()); }
    return <ResearchDialog title="Manage Account" submitLabel={confirmation === "role" ? "Confirm role change" : "Confirm status change"} showCancel submitDisabled={!confirmation || self || uncertain} onClose={onClose}
        action={async () => {
            if (!confirmation || self || uncertain) return { success: false, message: "Select an account action first." };
            try {
                const result = confirmation === "role" ? await changeUserRoleAction(user.id, role) : await changeUserStatusAction(user.id, !user.isActive);
                if (result.uncertain) setUncertain(true);
                resultMessage.current = result.message;
                return result;
            } catch { setUncertain(true); return { success: false, message: "The account update could not be confirmed. Refresh and verify the account before retrying." }; }
        }} onSuccess={() => onUpdated(resultMessage.current)}>
        <div className={styles.account}><strong>{name(user)}</strong><p className="form-help">{user.email}</p><p>Current role: {roleName(user.roleId)} · Status: {user.isActive ? "Active" : "Inactive"}</p></div>
        {self && <p className="form-help">You cannot change your own role or account status.</p>}
        {uncertain ? <><p role="alert">Further changes are paused until you refresh and verify this account.</p><button type="button" onClick={onRefresh}>Refresh directory</button></> : confirmation ? <>
            <p ref={confirmRef} tabIndex={-1} className={styles.confirmation}>{confirmation === "role" ? <>Change <strong>{name(user)} ({user.email})</strong> from {roleName(user.roleId)} to <strong>{roleName(role)}</strong>?</> : <>{user.isActive ? "Deactivate" : "Activate"} <strong>{name(user)} ({user.email})</strong>?</>}</p>
            <button type="button" className={shared.toggle} onClick={() => setConfirmation(null)}>Back to account actions</button>
        </> : <>
            <label>New role<select aria-label="New role" value={role} disabled={self} onChange={event => setRole(Number(event.target.value))}>{roles.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <div className={styles.actions}><button type="button" disabled={self || role === user.roleId} onClick={() => confirm("role")}>Update Role</button><button type="button" disabled={self} onClick={() => confirm("status")}>{user.isActive ? "Deactivate" : "Activate"}</button></div>
            {[1, 2].includes(user.roleId) && <button type="button" className={shared.toggle} onClick={onEligibility}>AI eligibility</button>}
        </>}
    </ResearchDialog>;
}
