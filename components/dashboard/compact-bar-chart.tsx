import styles from "./compact-bar-chart.module.css";

export default function CompactBarChart({ label, rows, emptyMessage }: {
    label: string;
    rows: { label: string; value: number }[];
    emptyMessage: string;
}) {
    const largest = Math.max(0, ...rows.map(row => row.value));
    return <figure className={styles.chart} aria-label={label}>
        <dl className={styles.rows}>
            {rows.map(row => <div className={styles.row} key={row.label}>
                <dt>{row.label}</dt>
                <dd>
                    <span className={styles.track} aria-hidden="true"><span className={styles.bar} style={{ width: `${largest ? row.value / largest * 100 : 0}%` }} /></span>
                    <span className={styles.value}>{row.value.toLocaleString("en-PH")}</span>
                </dd>
            </div>)}
        </dl>
        {largest === 0 ? <p className="form-help">{emptyMessage}</p> : null}
    </figure>;
}
