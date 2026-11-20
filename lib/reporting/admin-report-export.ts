import "server-only";
import { reportGenerationLabel, SNAPSHOT_LABEL } from "./admin-report";
import { GROUP_REPORT_COLUMNS, groupReportValues, reportTypeLabel, type SnapshotReport } from "./snapshot-report";

export function reportFileName(report: SnapshotReport, format: "xlsx" | "pdf") {
    const name = report.reportType === "current-supervision-summary" ? "current-research-supervision-summary" : "current-research-summary";
    return `thesishs-${name}-${report.generatedAt.replace(/[-:.]/g, "")}.${format}`;
}

function metadata(report: SnapshotReport) {
    return [
        ["Report", report.title], ["Report type", reportTypeLabel(report)],
        ["Reporting timezone", report.timezone], ["Generated", `${reportGenerationLabel(report.generatedAt)} (${report.timezone})`],
        ["Authorized scope", report.scope], ["Statistics basis", SNAPSHOT_LABEL],
        ["Selected sections", report.sections.map(section => section.label).join(", ")],
        ["Limitations", report.notes.join(" ")],
    ];
}

export async function renderReportXlsx(report: SnapshotReport): Promise<Uint8Array> {
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
        const groups = section.groupRows;
        const lastColumn = groups ? "E" : "B";
        sheet.columns = groups ? [{ width: 18 }, { width: 16 }, { width: 15 }, { width: 20 }, { width: 20 }] : [{ width: 48 }, { width: 18 }];
        sheet.addRow([section.label]);
        sheet.addRow([SNAPSHOT_LABEL]);
        sheet.mergeCells(`A2:${lastColumn}2`);
        sheet.addRow([section.note]);
        sheet.mergeCells(`A3:${lastColumn}3`);
        sheet.getRow(3).height = 42;
        sheet.addRow(groups ? [...GROUP_REPORT_COLUMNS] : ["Metric", "Count"]);
        // Explicit string and number values only. No formulas, hyperlinks or raw DB text.
        if (groups) {
            groups.forEach(group => sheet.addRow(groupReportValues(group)));
            for (const column of [3, 4, 5]) sheet.getColumn(column).numFmt = "#,##0";
        } else {
            section.rows.forEach(item => sheet.addRow([String(item.label), item.value]));
            sheet.getColumn(2).numFmt = "#,##0";
        }
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

export async function renderReportPdf(report: SnapshotReport): Promise<Uint8Array> {
    const { default: PDFDocument } = await import("pdfkit");
    const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true,
        info: { Title: report.title, Author: "ThesiSHS AI", CreationDate: new Date(report.generatedAt) } });
    const chunks: Buffer[] = [];
    const output = new Promise<Uint8Array>((resolve, reject) => {
        doc.on("data", chunk => chunks.push(Buffer.from(chunk)));
        doc.on("error", reject);
        doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    });
    // Server-owned English labels and numeric group identifiers avoid exporting private free text.
    // Standard Helvetica covers this catalog; names/manuscripts would require a Unicode font.
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
        if (section.groupRows) {
            const widths = [70, 65, 65, 125, 125];
            const groupLine = (values: readonly (string | number)[], bold: boolean) => {
                const y = doc.y;
                let x = 48;
                doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
                values.forEach((value, index) => {
                    doc.text(String(value), x, y, { width: widths[index] - 5, align: index > 1 ? "right" : "left" });
                    x += widths[index];
                });
                doc.y = y + 27; doc.x = 48;
            };
            groupLine(GROUP_REPORT_COLUMNS, true);
            if (!section.groupRows.length) doc.font("Helvetica").fontSize(9).text("No supervised groups are currently available.");
            for (const group of section.groupRows) {
                if (doc.y > 730) { doc.addPage(); groupLine(GROUP_REPORT_COLUMNS, true); }
                groupLine(groupReportValues(group), false);
            }
            continue;
        }
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
