import type { ReactNode } from "react";
import styles from "./review-workspace.module.css";

export default function ReviewWorkspace({ document, children, version, reviewTitle = "Adviser Review" }: { document: ReactNode; children: ReactNode; version?: string; reviewTitle?: string }) {
    return <div className={styles.container}><div className={styles.workspace}>
        <section className={`dashboard-panel ${styles.document}`} aria-labelledby="document-heading">
            <div className={styles.panelHeading}><h2 id="document-heading">Research Document</h2>{version && <p className="form-help">{version} · PDF</p>}</div>
            {document}
        </section>
        <section className={`dashboard-panel ${styles.review}`} aria-labelledby="review-heading">
            <div className={styles.panelHeading}><h2 id="review-heading">{reviewTitle}</h2></div>
            {children}
        </section>
    </div></div>;
}
