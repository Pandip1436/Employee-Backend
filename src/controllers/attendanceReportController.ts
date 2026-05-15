import { Response, NextFunction } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { AttendanceService } from "../services/attendanceService";
import { AuthRequest } from "../types";
import { ApiError } from "../utils/ApiError";

function formatTime(date: Date | string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

type Period = "daily" | "weekly" | "monthly";

// Resolve the (startDate, endDate, label, filenameSuffix) for the requested period.
// Supports the legacy `month=YYYY-MM` param and the new `period` + `date` params.
function resolveRange(q: any): { startDate: Date; endDate: Date; period: Period; label: string; fileTag: string } {
  const period = (q.period as Period) || (q.month ? "monthly" : undefined);
  if (!period) throw new ApiError(400, "period is required (daily | weekly | monthly)");

  if (period === "monthly") {
    const month = (q.month as string) || (q.date as string);
    if (!month) throw new ApiError(400, "month (or date) is required for monthly report");
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) throw new ApiError(400, "Invalid month format, expected YYYY-MM");
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    const label = start.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    return { startDate: start, endDate: end, period, label, fileTag: `${y}-${String(m).padStart(2, "0")}` };
  }

  const date = q.date as string;
  if (!date) throw new ApiError(400, "date is required (YYYY-MM-DD)");
  const base = new Date(date);
  if (isNaN(base.getTime())) throw new ApiError(400, "Invalid date format, expected YYYY-MM-DD");

  if (period === "daily") {
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999);
    const label = start.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    return { startDate: start, endDate: end, period, label, fileTag: date };
  }

  // weekly (Monday → Sunday containing the given date)
  const dow = base.getDay(); // 0=Sun..6=Sat
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diffToMon);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  const label = `${fmt(start)} → ${fmt(end)}, ${end.getFullYear()}`;
  const pad = (n: number) => String(n).padStart(2, "0");
  const fileTag = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}_to_${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
  return { startDate: start, endDate: end, period, label, fileTag };
}

const periodTitle: Record<Period, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export class AttendanceReportController {
  // GET /attendance/report/monthly?month=2026-04   (legacy, kept for compat)
  // GET /attendance/report/monthly?period=weekly&date=2026-04-16
  static async getMonthlyReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate, period, label } = resolveRange(req.query);
      const userId = req.user!.role === "employee" ? req.user!._id.toString() : (req.query.userId as string);
      const base = await AttendanceService.getReportForRange(startDate, endDate, userId);

      res.status(200).json({
        success: true,
        message: `${periodTitle[period]} report generated.`,
        data: { ...base, period, label },
      });
    } catch (error) { next(error); }
  }

  // GET /attendance/report/export-excel?period=weekly&date=2026-04-16
  static async exportExcel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate, period, label, fileTag } = resolveRange(req.query);
      const userId = req.user!.role === "employee" ? req.user!._id.toString() : (req.query.userId as string);
      const report = await AttendanceService.getReportForRange(startDate, endDate, userId);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "United Nexa Tech";
      workbook.created = new Date();

      // ── Summary Sheet ──
      const summary = workbook.addWorksheet("Summary");
      summary.columns = [
        { header: "Employee", key: "name", width: 25 },
        { header: "Email", key: "email", width: 30 },
        { header: "Department", key: "department", width: 20 },
        { header: "Present", key: "present", width: 10 },
        { header: "Late", key: "late", width: 10 },
        { header: "Half Day", key: "halfDay", width: 10 },
        { header: "Absent", key: "absent", width: 10 },
        { header: "Total Hours", key: "totalHours", width: 12 },
      ];

      // Style header
      summary.getRow(1).eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
        cell.alignment = { horizontal: "center" };
        cell.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } };
      });

      for (const emp of report.employees) {
        summary.addRow({
          name: emp.name,
          email: emp.email,
          department: emp.department,
          present: emp.presentDays,
          late: emp.lateDays,
          halfDay: emp.halfDays,
          absent: emp.absentDays,
          totalHours: parseFloat(emp.totalHours.toFixed(2)),
        });
      }

      // ── Detail Sheet ──
      const detail = workbook.addWorksheet("Daily Records");
      detail.columns = [
        { header: "Date", key: "date", width: 15 },
        { header: "Employee", key: "name", width: 25 },
        { header: "Department", key: "department", width: 20 },
        { header: "Clock In", key: "clockIn", width: 12 },
        { header: "Clock Out", key: "clockOut", width: 12 },
        { header: "Total Hours", key: "totalHours", width: 12 },
        { header: "Status", key: "status", width: 12 },
      ];

      detail.getRow(1).eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
        cell.alignment = { horizontal: "center" };
      });

      for (const r of report.allRecords) {
        const user = r.userId as any;
        detail.addRow({
          date: formatDate(r.date),
          name: user.name || "Unknown",
          department: user.department || "",
          clockIn: formatTime(r.clockIn),
          clockOut: formatTime(r.clockOut),
          totalHours: r.totalHours ? parseFloat(r.totalHours.toFixed(2)) : 0,
          status: r.status,
        });
      }

      // Alternate row colors for detail sheet
      detail.eachRow((row, num) => {
        if (num > 1 && num % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
          });
        }
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=attendance-${period}-${fileTag}.xlsx`);

      // Also title the summary sheet with the range label.
      summary.insertRow(1, [`${periodTitle[period]} Attendance — ${label}`]);
      summary.mergeCells(1, 1, 1, 8);
      summary.getRow(1).font = { bold: true, size: 13 };
      summary.getRow(1).alignment = { horizontal: "center" };

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) { next(error); }
  }

  // GET /attendance/report/export-pdf?period=weekly&date=2026-04-16
  static async exportPdf(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate, period, label, fileTag } = resolveRange(req.query);
      const userId = req.user!.role === "employee" ? req.user!._id.toString() : (req.query.userId as string);
      const report = await AttendanceService.getReportForRange(startDate, endDate, userId);

      // ── Page geometry ──
      const PAGE_W = 595.28;
      const PAGE_H = 841.89;
      const MARGIN = 40;
      const CONTENT_W = PAGE_W - MARGIN * 2;     // 515.28
      const CONTENT_R = PAGE_W - MARGIN;          // 555.28
      const HEADER_H = 70;
      const FOOTER_RESERVE = 40;                  // distance from page bottom reserved for footer
      const BODY_BOTTOM = PAGE_H - FOOTER_RESERVE;

      type Align = "left" | "right" | "center";
      type Col = { label: string; width: number; align?: Align };

      // Column definitions — widths sum to exactly CONTENT_W (515)
      const summaryCols: Col[] = [
        { label: "Employee",   width: 140 },
        { label: "Department", width: 135 },
        { label: "Present",    width: 45, align: "center" },
        { label: "Late",       width: 45, align: "center" },
        { label: "Half",       width: 45, align: "center" },
        { label: "Absent",     width: 45, align: "center" },
        { label: "Hours",      width: 60, align: "right"  },
      ];

      const dailyCols: Col[] = [
        { label: "Date",      width: 80  },
        { label: "Employee",  width: 130 },
        { label: "Clock In",  width: 75, align: "center" },
        { label: "Clock Out", width: 75, align: "center" },
        { label: "Hours",     width: 55, align: "right"  },
        { label: "Status",    width: 100, align: "center" },
      ];

      // Status pill palette (background + text)
      const statusColors: Record<string, { bg: string; fg: string }> = {
        present:  { bg: "#DCFCE7", fg: "#166534" },
        late:     { bg: "#FEF3C7", fg: "#92400E" },
        "half-day": { bg: "#FFEDD5", fg: "#9A3412" },
        absent:   { bg: "#FEE2E2", fg: "#991B1B" },
        weekend:  { bg: "#E0E7FF", fg: "#3730A3" },
        holiday:  { bg: "#E0E7FF", fg: "#3730A3" },
        leave:    { bg: "#F3E8FF", fg: "#6B21A8" },
      };

      // margins: 0 + autoFirstPage: false — we manage all positioning manually and
      // attach a pageAdded handler so every page (including the first) gets a
      // consistent header + footer band. Setting bottom margin to 0 prevents
      // PDFKit from auto-paginating when we draw the footer near the page bottom.
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        autoFirstPage: false,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=attendance-${period}-${fileTag}.pdf`);
      doc.pipe(res);

      // ── Helpers ──
      // Truncate `text` to fit within `maxWidth` (in current font), appending "…" if it had to clip.
      const fit = (text: string, maxWidth: number): string => {
        if (doc.widthOfString(text) <= maxWidth) return text;
        let s = text;
        while (s.length > 1 && doc.widthOfString(s + "…") > maxWidth) s = s.slice(0, -1);
        return s + "…";
      };

      // Draw a status pill, centered horizontally in the given cell box.
      const drawStatusPill = (status: string, cellX: number, cellY: number, cellW: number, rowH: number) => {
        const label = status || "—";
        const tone = statusColors[label.toLowerCase()] || { bg: "#F3F4F6", fg: "#374151" };
        doc.font("Helvetica-Bold").fontSize(7);
        const pillTextW = doc.widthOfString(label);
        const pillW = Math.min(pillTextW + 16, cellW - 6);
        const pillH = 13;
        const pillX = cellX + (cellW - pillW) / 2;
        const pillY = cellY + (rowH - pillH) / 2;
        doc.roundedRect(pillX, pillY, pillW, pillH, 6).fill(tone.bg);
        doc.fillColor(tone.fg).text(fit(label, pillW - 8), pillX, pillY + 3, {
          width: pillW,
          align: "center",
          lineBreak: false,
        });
      };

      // Compute x-position and width for each column (boundaries are exact).
      const colBox = (cols: Col[], i: number) => {
        let x = MARGIN;
        for (let k = 0; k < i; k++) x += cols[k].width;
        return { x, w: cols[i].width };
      };

      // Draw the page header band — title left, range right.
      const drawPageHeader = (titlePrefix?: string) => {
        doc.rect(0, 0, PAGE_W, HEADER_H).fill("#4F46E5");
        doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(18)
          .text(`${periodTitle[period]} Attendance Report${titlePrefix ? ` — ${titlePrefix}` : ""}`,
                MARGIN, 22, { width: CONTENT_W, lineBreak: false });
        doc.font("Helvetica").fontSize(10)
          .text(`United Nexa Tech · ${label}`, MARGIN, 46, { width: CONTENT_W, lineBreak: false });
      };

      // Draw the bottom footer band on the current page.
      const drawPageFooter = () => {
        const y = PAGE_H - 28;
        doc.moveTo(MARGIN, y - 6).lineTo(CONTENT_R, y - 6)
          .strokeColor("#E5E7EB").lineWidth(0.5).stroke();
        doc.font("Helvetica").fontSize(8).fillColor("#9CA3AF").text(
          `Generated on ${new Date().toLocaleString("en-IN")} · United Nexa Tech Employee Portal`,
          MARGIN, y, { align: "center", width: CONTENT_W, lineBreak: false }
        );
      };

      // Draw a table header row at y, returns the y BELOW the header.
      const TABLE_H_HEIGHT = 22;
      const drawTableHeader = (cols: Col[], y: number): number => {
        doc.rect(MARGIN, y, CONTENT_W, TABLE_H_HEIGHT).fill("#EEF2FF");
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#3730A3");
        cols.forEach((c, i) => {
          const { x, w } = colBox(cols, i);
          doc.text(c.label, x + 6, y + 7, {
            width: w - 12,
            align: c.align ?? "left",
            lineBreak: false,
          });
        });
        // Bottom hairline under header
        doc.moveTo(MARGIN, y + TABLE_H_HEIGHT).lineTo(MARGIN + CONTENT_W, y + TABLE_H_HEIGHT)
          .strokeColor("#C7D2FE").lineWidth(0.6).stroke();
        return y + TABLE_H_HEIGHT;
      };

      // Draw one data row. `values` is parallel to `cols`. `rowIdx` toggles striping.
      // Special-case Status column when the column label is "Status" — render as pill.
      const ROW_HEIGHT = 20;
      const drawRow = (cols: Col[], values: string[], y: number, rowIdx: number, statusRaw?: string) => {
        if (rowIdx % 2 === 1) {
          doc.rect(MARGIN, y, CONTENT_W, ROW_HEIGHT).fill("#F9FAFB");
        }
        doc.font("Helvetica").fontSize(9).fillColor("#1F2937");
        cols.forEach((c, i) => {
          const { x, w } = colBox(cols, i);
          if (c.label === "Status" && statusRaw) {
            drawStatusPill(statusRaw, x, y, w, ROW_HEIGHT);
            return;
          }
          doc.font("Helvetica").fontSize(9).fillColor("#1F2937");
          const v = values[i] ?? "";
          doc.text(fit(v, w - 12), x + 6, y + 6, {
            width: w - 12,
            align: c.align ?? "left",
            lineBreak: false,
          });
        });
        // Subtle bottom border
        doc.moveTo(MARGIN, y + ROW_HEIGHT).lineTo(MARGIN + CONTENT_W, y + ROW_HEIGHT)
          .strokeColor("#F1F5F9").lineWidth(0.4).stroke();
      };

      // pageAdded fires for every page (including the first, because of autoFirstPage:false).
      doc.on("pageAdded", () => {
        drawPageHeader();
        drawPageFooter();
      });

      const BODY_TOP = HEADER_H + 20;

      const startBodyOnNewPage = (): number => {
        doc.addPage();
        return BODY_TOP;
      };

      // ── First page ──
      doc.addPage(); // triggers pageAdded → header + footer drawn
      let y = BODY_TOP;

      // Draw a section header (title + table column header). Returns next y.
      const drawSection = (title: string, cols: Col[], yy: number): number => {
        doc.font("Helvetica-Bold").fontSize(13).fillColor("#111827")
          .text(title, MARGIN, yy, { width: CONTENT_W, lineBreak: false });
        yy += 22;
        return drawTableHeader(cols, yy);
      };

      // Section: Employee Summary
      y = drawSection("Employee Summary", summaryCols, y);

      let rowIdx = 0;
      for (const emp of report.employees) {
        if (y + ROW_HEIGHT > BODY_BOTTOM) {
          y = drawSection("Employee Summary (cont.)", summaryCols, startBodyOnNewPage());
        }
        const values = [
          emp.name,
          emp.department || "—",
          String(emp.presentDays),
          String(emp.lateDays),
          String(emp.halfDays),
          String(emp.absentDays),
          `${emp.totalHours.toFixed(1)}h`,
        ];
        drawRow(summaryCols, values, y, rowIdx);
        y += ROW_HEIGHT;
        rowIdx++;
      }
      if (report.employees.length === 0) {
        doc.font("Helvetica-Oblique").fontSize(9).fillColor("#6B7280")
          .text("No records for this period.", MARGIN + 6, y + 6, { width: CONTENT_W - 12, lineBreak: false });
        y += ROW_HEIGHT;
      }

      // Section: Daily Records — leave some breathing room, start fresh page if too tight
      y += 24;
      if (y + 80 > BODY_BOTTOM) y = startBodyOnNewPage();
      y = drawSection("Daily Records", dailyCols, y);

      rowIdx = 0;
      for (const r of report.allRecords) {
        if (y + ROW_HEIGHT > BODY_BOTTOM) {
          y = drawSection("Daily Records (cont.)", dailyCols, startBodyOnNewPage());
        }
        const user = r.userId as any;
        const values = [
          formatDate(r.date),
          user?.name || "Unknown",
          formatTime(r.clockIn),
          formatTime(r.clockOut),
          r.totalHours ? `${r.totalHours.toFixed(1)}h` : "—",
          r.status || "—",
        ];
        drawRow(dailyCols, values, y, rowIdx, r.status || undefined);
        y += ROW_HEIGHT;
        rowIdx++;
      }
      if (report.allRecords.length === 0) {
        doc.font("Helvetica-Oblique").fontSize(9).fillColor("#6B7280")
          .text("No daily records for this period.", MARGIN + 6, y + 6, { width: CONTENT_W - 12, lineBreak: false });
      }

      doc.end();
    } catch (error) { next(error); }
  }
}
