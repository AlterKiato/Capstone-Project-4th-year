"use client";

import { useEffect, useRef, useState } from "react";
import { ACTIVITY_LIMITATION, ADMIN_REPORT_SECTIONS, type AdminReport, type AdminReportRequest, type ReportSectionId } from "@/lib/reporting/admin-report";
import AdminReportTables from "./admin-report-tables";
import styles from "./admin-report.module.css";

export default function AdminReportControls({ initialReport, initialError }: {
    initialReport: AdminReport | null; initialError?: string;
}) {
    const [selection, setSelection] = useState<"all" | "custom">("all");
    const [sections, setSections] = useState<ReportSectionId[]>(ADMIN_REPORT_SECTIONS.map(section => section.id));
    const [format, setFormat] = useState<"xlsx" | "pdf">("xlsx");
    const [report, setReport] = useState(initialReport);
    const [busy, setBusy] = useState<"preview" | "download" | null>(null);
    const [message, setMessage] = useState("");
    const [error, setError] = useState(initialError ?? "");
    const [dirty, setDirty] = useState(false);
    const [download, setDownload] = useState<{ url: string; name: string } | null>(null);
    const controller = useRef<AbortController | null>(null);
    useEffect(() => () => controller.current?.abort(), []);
    useEffect(() => () => { if (download) URL.revokeObjectURL(download.url); }, [download]);
    function changed() { setDirty(true); setMessage(""); setError(""); setDownload(null); }
    async function generate(action: "preview" | "download") {
        if (busy) return;
        setDownload(null); setMessage(""); setError("");
        if (selection === "custom" && !sections.length) { setError("Select at least one report section."); return; }
        setBusy(action);
        const abort = new AbortController();
        controller.current = abort;
        const request: AdminReportRequest = { reportType: "current-summary", selection, sections: selection === "all" ? [] : sections, format: action === "preview" ? "preview" : format };
        try {
            const response = await fetch("/api/admin/reports", { method: "POST", credentials: "same-origin", cache: "no-store",
                headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal: abort.signal });
            if (!response.ok) {
                const failure = await response.json().catch(() => null);
                throw new Error(failure?.message || "Report generation failed. Please try again.");
            }
            if (action === "preview") {
                setReport(await response.json()); setDirty(false); setMessage("Reporting tables updated.");
            } else {
                const blob = await response.blob();
                const name = response.headers.get("Content-Disposition")?.match(/filename="([a-zA-Z0-9._-]+)"/)?.[1] ?? `thesishs-current-research-summary.${format}`;
                const url = URL.createObjectURL(blob);
                setDownload({ url, name });
                const anchor = document.createElement("a");
                anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
                setMessage("Report generated. Download requested; use the download link if it did not start.");
            }
        } catch (failure) {
            if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Report generation failed. Please try again.");
        } finally { if (!abort.signal.aborted) setBusy(null); }
    }
    return <section aria-labelledby="report-export-heading" className={`dashboard-panel ${styles.panel}`}>
        <h2 id="report-export-heading">Current Research Summary</h2>
        <p className="form-help">Export current user, group, research status and repository statistics. Each update or download reads a fresh current snapshot.</p>
        <div className={styles.notice}>
            <h3>Research Activity Report</h3>
            <p>{ACTIVITY_LIMITATION}</p>
        </div>
        <form onSubmit={event => { event.preventDefault(); void generate("download"); }}>
            <fieldset disabled={busy !== null} className={styles.fields}>
                <legend className="sr-only">Report options</legend>
                <label>Data selection<select value={selection} onChange={event => { changed(); setSelection(event.target.value as "all" | "custom"); }}>
                    <option value="all">Export All</option><option value="custom">Custom Selection</option>
                </select></label>
                <label>File format<select value={format} onChange={event => { setFormat(event.target.value as "xlsx" | "pdf"); setDownload(null); setMessage(""); }}>
                    <option value="xlsx">Excel (.xlsx)</option><option value="pdf">PDF (.pdf)</option>
                </select></label>
                {selection === "custom" ? <fieldset className={styles.sections}><legend>Report sections</legend>
                    {ADMIN_REPORT_SECTIONS.map(section => <label key={section.id}><input type="checkbox" checked={sections.includes(section.id)}
                        onChange={event => { changed(); setSections(current => event.target.checked ? [...current, section.id] : current.filter(id => id !== section.id)); }} />{section.label}</label>)}
                </fieldset> : null}
                <div className={styles.actions}>
                    <button type="button" className={styles.secondary} onClick={event => { if (event.currentTarget.form?.reportValidity()) void generate("preview"); }}>{busy === "preview" ? "Updating tables..." : "Update tables"}</button>
                    <button type="submit">{busy === "download" ? "Generating report..." : "Generate and Download"}</button>
                </div>
            </fieldset>
        </form>
        <div role="status" aria-live="polite" aria-atomic="true">{busy ? "Report request in progress." : message}
            {download ? <a className={styles.download} href={download.url} download={download.name}>Download {download.name}</a> : null}
        </div>
        {error ? <p role="alert" className="form-message">{error}</p> : null}
        {dirty ? <p className="form-help">Selections changed. Update tables to show this selection; downloads use the current controls.</p> : null}
        <div aria-busy={busy === "preview"}>{report ? <AdminReportTables report={report} /> : <p className="form-help">Reporting tables are unavailable. Use Update tables to try again.</p>}</div>
    </section>;
}
