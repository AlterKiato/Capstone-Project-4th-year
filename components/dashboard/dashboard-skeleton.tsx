import styles from "./dashboard-skeleton.module.css";

type SkeletonPage = "student" | "submissions" | "workspace" | "adviser" | "groups" | "admin";
const titles: Record<SkeletonPage, string> = {
    student: "Student Dashboard", submissions: "Research Submissions", workspace: "Group Workspace",
    adviser: "Adviser Dashboard", groups: "Research Groups", admin: "Admin Dashboard",
};

function Lines() {
    return <div className={styles.lines}><span className={styles.medium} /><span /><span className={styles.short} /></div>;
}

function Panel({ rows = 0 }: { rows?: number }) {
    return <div className={styles.panel}><span className={styles.sectionTitle} />
        {rows ? Array.from({ length: rows }, (_, index) => <div className={styles.row} key={index}><Lines /></div>) : <Lines />}
    </div>;
}

function Metrics({ count }: { count: 3 | 4 }) {
    return <div className={`${styles.metrics} ${count === 4 ? styles.four : ""}`}>
        {Array.from({ length: count }, (_, index) => <div className={styles.panel} key={index}>
            <span className={styles.medium} /><span className={styles.value} /><span className={styles.short} />
        </div>)}
    </div>;
}

function Selector() {
    return <div className={styles.selector}><span className={styles.short} /><span className={styles.field} /></div>;
}

/** Static presentation only. Placeholder shapes never represent records or controls. */
export default function DashboardSkeleton({ page }: { page: SkeletonPage }) {
    return <main className={`dashboard-page ${styles.page}`} aria-label={titles[page]} aria-busy="true" data-skeleton={page}>
        <p role="status" className={styles.status}>Loading {titles[page].toLowerCase()}…</p>
        <div aria-hidden="true">
            <div className={styles.header}><span className={styles.heading} /><div className={styles.headerTools}><span /><span /></div></div>
            {page !== "student" && <span className={styles.context} />}
            {page === "student" && <div className={styles.columns}><Panel rows={2} /><Panel /></div>}
            {page === "submissions" && <>
                <div className={styles.toolbar}><Selector /><span className={styles.action} /></div>
                <Panel />
                <div className={styles.toolbar}><span className={styles.sectionTitle} /><span className={styles.action} /></div>
                <Panel rows={3} />
            </>}
            {page === "workspace" && <>
                <Selector /><div className={styles.tabs}><span /><span /></div>
                <span className={styles.sectionTitle} />
                <div className={styles.stack}><Panel rows={1} /><Panel rows={1} /><Panel rows={1} /></div>
            </>}
            {page === "adviser" && <><Metrics count={3} /><Panel rows={2} /><Panel rows={2} /></>}
            {page === "groups" && <>
                <Metrics count={3} /><div className={styles.toolbar}><span className={styles.medium} /><span className={styles.action} /></div>
                <div className={styles.panel}><Selector /><div className={styles.row}><Lines /></div><div className={styles.row}><Lines /></div></div>
            </>}
            {page === "admin" && <>
                <Metrics count={4} /><div className={styles.secondary}><span /><span /></div><Panel rows={3} />
            </>}
        </div>
    </main>;
}
