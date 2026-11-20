import "server-only";
import type { AdminReport } from "./admin-report";
import { reportGenerationLabel, SNAPSHOT_LABEL } from "./admin-report";

export function reportFileName(report: AdminReport, format: "xlsx" | "pdf") {
    return `thesishs-current-research-summary-${report.generatedAt.replace(/[-:.]/g, "")}.${format}`;
}

function metadata(report: AdminReport) {
    return [
        ["Report", report.title], ["Report type", "Current Research Summary"],
        ["Reporting timezone", report.timezone], ["Generated", `${reportGenerationLabel(report.generatedAt)} (${report.timezone})`],
        ["Authorized scope", report.scope], ["Statistics basis", SNAPSHOT_LABEL],
        ["Selected sections", report.sections.map(section => section.label).join(", ")],
        ["Limitations", report.notes.join(" ")],
    ];
}

export async function renderReportXlsx(report: AdminReport): Promise<Uint8Array> {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ThesiSHS AI";
    workbook.created = new Date(report.generatedAt);
    const info = workbook.addWorksheet("Report Information");
    info.columns = [{ width: 26 }, { width: 90 }];
    info.addRow(["Report information", "Value"]);
    metadata(report).forEach(values => info.addRow(values));
    for (const section of report.sections) {
        const sheet = workbook.addWorksheet(section.label);
        sheet.columns = [{ width: 48 }, { width: 18 }];
        sheet.addRow([section.label]);
        sheet.addRow([SNAPSHOT_LABEL]);
        sheet.mergeCells("A2:B2");
        sheet.addRow([section.note]);
        sheet.mergeCells("A3:B3");
        sheet.getRow(3).height = 42;
        sheet.addRow(["Metric", "Count"]);
        // Explicit string and number values only. No formulas, hyperlinks or raw DB text.
        section.rows.forEach(item => sheet.addRow([String(item.label), item.value]));
        sheet.getColumn(2).numFmt = "#,##0";
        sheet.views = [{ state: "frozen", ySplit: 4 }];
        sheet.getRow(4).font = { bold: true };
    }
    workbook.eachSheet(sheet => {
        sheet.getRow(1).font = { bold: true, size: 14 };
        sheet.eachRow((record, index) => {
            record.alignment = { vertical: "top", wrapText: true };
            if (sheet === info && index > 1) record.height = index === 9 || index === 10 ? 56 : 34;
        });
        sheet.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    });
    return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function renderReportPdf(report: AdminReport): Promise<Uint8Array> {
    const { default: PDFDocument } = await import("pdfkit");
    const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true,
        info: { Title: report.title, Author: "ThesiSHS AI", CreationDate: new Date(report.generatedAt) } });
    const chunks: Buffer[] = [];
    const output = new Promise<Uint8Array>((resolve, reject) => {
        doc.on("data", chunk => chunks.push(Buffer.from(chunk)));
        doc.on("error", reject);
        doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    });
    // Only server-owned English aggregate labels are exported; no names/manuscripts.
    // Standard Helvetica covers this catalog. New free-text sections require a bundled Unicode font.
    doc.font("Helvetica-Bold").fontSize(17).text(report.title);
    doc.moveDown(0.6);
    for (const [label, value] of metadata(report).slice(1)) {
        doc.font("Helvetica-Bold").fontSize(9).text(`${label}: `, { continued: true });
        doc.font("Helvetica").text(value);
        doc.moveDown(0.35);
    }
    for (const section of report.sections) {
        // These small aggregate sections fit on a page; keep their headings and rows together.
        if (doc.y + 90 + section.rows.length * 27 > 735) doc.addPage();
        doc.moveDown(0.8).font("Helvetica-Bold").fontSize(12).text(section.label);
        doc.font("Helvetica").fontSize(9).text(SNAPSHOT_LABEL).text(section.note);
        doc.moveDown(0.6);
        const header = () => {
            doc.font("Helvetica-Bold").fontSize(10);
            const y = doc.y;
            doc.text("Metric", 48, y, { width: 380 });
            doc.text("Count", 438, y, { width: 60, align: "right" });
            doc.y = y + 22;
        };
        header();
        for (const item of section.rows) {
            if (doc.y > 730) { doc.addPage(); header(); }
            const y = doc.y;
            doc.font("Helvetica").fontSize(10).text(item.label, 48, y, { width: 375 });
            doc.text(String(item.value), 438, y, { width: 60, align: "right" });
            doc.moveTo(48, y + 18).lineTo(498, y + 18).strokeColor("#d8d2c2").lineWidth(0.5).stroke();
            doc.y = y + 27;
            doc.x = 48;
        }
    }
    const pages = doc.bufferedPageRange();
    for (let page = 0; page < pages.count; page++) {
        doc.switchToPage(page);
        doc.font("Helvetica").fontSize(8).fillColor("#333333").text(`Page ${page + 1} of ${pages.count}`, 48, 770, { lineBreak: false, width: 450, align: "right" });
    }
    doc.end();
    return output;
}
