import { reportGenerationLabel, SNAPSHOT_LABEL, type AdminReport } from "@/lib/reporting/admin-report";
import styles from "./admin-report.module.css";

export default function AdminReportTables({ report }: { report: AdminReport }) {
    return <section aria-label="Report tables" className={styles.results}>
        <div className={styles.metadata}>
            <h3>Reporting tables</h3>
            <p>Report type: Current Research Summary</p>
            <p className="form-help">Generated <time dateTime={report.generatedAt}>{reportGenerationLabel(report.generatedAt)}</time> ({report.timezone}). {report.scope}.</p>
            <p className="form-help">{SNAPSHOT_LABEL}. These values do not describe the end of a historical period.</p>
        </div>
        <div className={styles.tables}>{report.sections.map(section => <div className={styles.tableBlock} key={section.id}>
            <div className={styles.scroll} tabIndex={0} role="region" aria-label={`${section.label} table`}>
                <table>
                    <caption>{section.label}</caption>
                    <thead><tr><th scope="col">Metric</th><th scope="col">Count</th></tr></thead>
                    <tbody>{section.rows.map(row => <tr key={row.id}><th scope="row">{row.label}</th><td>{row.value.toLocaleString("en-PH")}</td></tr>)}</tbody>
                </table>
            </div>
            <p className="form-help">{section.note}</p>
            {section.rows.every(row => row.value === 0) ? <p className="form-help">No records are currently available for this section.</p> : null}
        </div>)}</div>
    </section>;
}
