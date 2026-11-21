"use client";

import { useEffect, useId, useRef, useState } from "react";
import { reportPeriodSchema, resolveReportPeriod, type ReportPeriod } from "@/lib/reporting/admin-report";
import { ACTIVITY_UNAVAILABLE, coverageLabel, type ActivityAvailability, type PeriodActivityReport, type defaultActivityPeriods } from "@/lib/reporting/period-activity";
import styles from "./admin-report.module.css";

export default function PeriodActivityControls({ kind, availability, defaults }: {
    kind: "admin" | "main"; availability: ActivityAvailability; defaults: ReturnType<typeof defaultActivityPeriods>;
}) {
    const heading = useId();
    const [period, setPeriod] = useState<ReportPeriod>(defaults.monthly);
    const [format, setFormat] = useState<"xlsx" | "pdf">("xlsx");
    const [report, setReport] = useState<PeriodActivityReport | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [unavailable, setUnavailable] = useState<"before-cutover" | "unavailable" | null>(null);
    const [download, setDownload] = useState<{ url: string; name: string } | null>(null);
    const controller = useRef<AbortController | null>(null);
    const configured = availability === "configured";
    useEffect(() => () => controller.current?.abort(), []);
    useEffect(() => () => { if (download) URL.revokeObjectURL(download.url); }, [download]);
    let periodLabel = "Choose a valid reporting period.";
    try { periodLabel = resolveReportPeriod(reportPeriodSchema.parse(period)).label; } catch { /* Keep invalid input editable. */ }
    function change(next: ReportPeriod) { setPeriod(next); setReport(null); setDownload(null); setError(""); setMessage(""); setUnavailable(null); }
    async function generate(action: "preview" | "download") {
        if (!configured || controller.current || (action === "download" && !report)) return;
        try { resolveReportPeriod(reportPeriodSchema.parse(period)); }
        catch { setError("Choose a valid week, month or year."); return; }
        const abort = new AbortController(); controller.current = abort;
        setBusy(true); setError(""); setMessage(""); setDownload(null); setUnavailable(null);
        try {
            const response = await fetch(`/api/${kind === "main" ? "adviser" : "admin"}/reports/activity`, {
                method: "POST", credentials: "same-origin", cache: "no-store", signal: abort.signal,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reportType: "period-activity", period, format: action === "preview" ? "preview" : format,
                    ...(action === "download" ? { expectedTotals: report!.totals } : {}) }),
            });
            if (!response.ok) {
                const failure = await response.json().catch(() => null);
                if (abort.signal.aborted) return;
                setReport(null);
                setUnavailable(failure?.coverageStatus === "before-cutover" ? "before-cutover" : "unavailable");
                throw new Error(failure?.message || "Activity reporting is unavailable. Please try again.");
            }
            if (action === "preview") {
                const next: PeriodActivityReport = await response.json();
                if (abort.signal.aborted) return;
                setReport(next); setMessage("Activity tables updated.");
            } else {
                const blob = await response.blob();
                if (abort.signal.aborted) return;
                const name = response.headers.get("Content-Disposition")?.match(/filename="([a-zA-Z0-9._-]+)"/)?.[1] ?? `thesishs-period-activity-${period.value}.${format}`;
                const url = URL.createObjectURL(blob); setDownload({ url, name });
                const anchor = document.createElement("a"); anchor.href = url; anchor.download = name;
                document.body.appendChild(anchor); anchor.click(); anchor.remove();
                setMessage("Activity report generated. Use the download link if the download did not start.");
            }
        } catch (failure) {
            if (!abort.signal.aborted) {
                setReport(null); setUnavailable(current => current ?? "unavailable");
                setError(failure instanceof Error ? failure.message : "Activity reporting is unavailable.");
            }
        }
        finally { controller.current = null; if (!abort.signal.aborted) setBusy(false); }
    }
    return <section className={`dashboard-panel ${styles.panel}`} aria-labelledby={heading}>
        <h2 id={heading}>Period Activity</h2>
        <p className="form-help">Successful submission versions and official academic decisions, using Asia/Manila calendar periods.</p>
        {!configured ? <p className={styles.notice}>{availability === "invalid" ? "Activity reporting is unavailable pending activation review. Current snapshot reports remain available." : ACTIVITY_UNAVAILABLE}</p> : null}
        <form onSubmit={event => { event.preventDefault(); void generate("preview"); }}>
            <fieldset disabled={busy} className={styles.fields}>
                <legend className="sr-only">Activity report options</legend>
                <label>Period type<select value={period.kind} onChange={event => change(defaults[event.target.value as ReportPeriod["kind"]])}>
                    <option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                </select></label>
                <label>{period.kind === "weekly" ? "ISO week (YYYY-Www)" : period.kind === "monthly" ? "Calendar month" : "Calendar year"}
                    <input type={period.kind === "monthly" ? "month" : period.kind === "yearly" ? "number" : "text"}
                        value={period.value} required min={period.kind === "yearly" ? 1900 : period.kind === "monthly" ? "1900-01" : undefined}
                        max={period.kind === "yearly" ? 2199 : period.kind === "monthly" ? "2199-12" : undefined}
                        pattern={period.kind === "weekly" ? "(19|20|21)[0-9]{2}-W[0-9]{2}" : undefined}
                        onChange={event => change({ ...period, value: event.target.value })} />
                </label>
                <label>Activity file format<select value={format} onChange={event => { setFormat(event.target.value as "xlsx" | "pdf"); setDownload(null); }}>
                    <option value="xlsx">Excel (.xlsx)</option><option value="pdf">PDF (.pdf)</option>
                </select></label>
                <div className={styles.actions}>
                    <button type="submit" disabled={!configured}>{busy ? "Updating..." : "Update activity tables"}</button>
                    <button type="button" className={styles.secondary} disabled={!configured || !report} onClick={() => void generate("download")}>Download activity report</button>
                </div>
            </fieldset>
        </form>
        <p className="form-help">Selected period: {periodLabel}</p>
        <p className="form-help">Coverage: {!configured ? "UNAVAILABLE: awaiting verified activation" : unavailable === "before-cutover" ? "BEFORE CUTOVER: no activity coverage" : unavailable ? "UNAVAILABLE: update tables to retry" : report ? coverageLabel(report.coverage.status) : "Update tables to determine coverage"}.</p>
        <div role="status" aria-live="polite" aria-atomic="true">{busy ? "Activity report request in progress." : message}
            {download ? <a className={styles.download} href={download.url} download={download.name}>Download {download.name}</a> : null}
        </div>
        {error ? <p className="form-message" role="alert">{error}</p> : null}
        {report ? <div className={styles.results} aria-busy={busy}>
            <div className={styles.metadata}>
                <h3>{report.period.label}</h3>
                <p>{report.scope} · {coverageLabel(report.coverage.status)}</p>
                <p>UTC period: {report.period.startInclusive} (inclusive) to {report.period.endExclusive} (exclusive).</p>
                <p>Official UTC cutover: {report.coverage.cutoverUtc}. Included from: {report.coverage.effectiveStartInclusive}.</p>
                <p>Generated: <time dateTime={report.generatedAt}>{new Date(report.generatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</time> (Asia/Manila).</p>
            </div>
            <div className={styles.scroll}><table><caption>Activity totals</caption><thead><tr><th scope="col">Activity</th><th scope="col">Count</th></tr></thead>
                <tbody>{report.sections[0].rows.map(row => <tr key={row.id}><th scope="row">{row.label}</th><td>{row.value.toLocaleString("en-PH")}</td></tr>)}</tbody>
            </table></div>
            {report.notes.map(note => <p className="form-help" key={note}>{note}</p>)}
        </div> : null}
    </section>;
}
