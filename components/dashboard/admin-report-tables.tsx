import { reportGenerationLabel, SNAPSHOT_LABEL } from "@/lib/reporting/admin-report";
import { GROUP_REPORT_COLUMNS, groupReportValues, reportTypeLabel, type SnapshotReport } from "@/lib/reporting/snapshot-report";
import styles from "./admin-report.module.css";

export default function AdminReportTables({ report }: { report: SnapshotReport }) {
    return <section aria-label="Report tables" className={styles.results}>
        <div className={styles.metadata}>
            <h3>Reporting tables</h3>
            <p>Report type: {reportTypeLabel(report)}</p>
            <p className="form-help">Generated <time dateTime={report.generatedAt}>{reportGenerationLabel(report.generatedAt)}</time> ({report.timezone}). {report.scope}.</p>
            <p className="form-help">{SNAPSHOT_LABEL}. These values do not describe the end of a historical period.</p>
        </div>
        <div className={styles.tables}>{report.sections.map(section => <div className={`${styles.tableBlock} ${section.groupRows ? styles.groupBlock : ""}`} key={section.id}>
            <div className={styles.scroll} tabIndex={0} role="region" aria-label={`${section.label} table`}>
                <table className={section.groupRows ? styles.groupTable : undefined}>
                    <caption>{section.label}</caption>
                    <thead><tr>{(section.groupRows ? GROUP_REPORT_COLUMNS : ["Metric", "Count"]).map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
                    <tbody>{section.groupRows ? section.groupRows.map(group => <tr key={group.id}>{groupReportValues(group).map((value, index) =>
                        index === 0 ? <th scope="row" key={index}>{value}</th> : <td key={index}>{typeof value === "number" ? value.toLocaleString("en-PH") : value}</td>)}</tr>) :
                        section.rows.map(row => <tr key={row.id}><th scope="row">{row.label}</th><td>{row.value.toLocaleString("en-PH")}</td></tr>)}</tbody>
                </table>
            </div>
            <p className="form-help">{section.note}</p>
            {(section.groupRows ? !section.groupRows.length : section.rows.every(row => row.value === 0)) ? <p className="form-help">No records are currently available for this section.</p> : null}
        </div>)}</div>
    </section>;
}
