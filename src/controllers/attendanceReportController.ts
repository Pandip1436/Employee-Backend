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

export class AttendanceReportController {
  // GET /attendance/report/monthly?month=2026-04&format=json
  static async getMonthlyReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const month = req.query.month as string;
      if (!month) throw new ApiError(400, "month query param is required (e.g. 2026-04)");

      const userId = req.user!.role === "employee" ? req.user!._id.toString() : (req.query.userId as string);
      const report = await AttendanceService.getMonthlyReport(month, userId);

      res.status(200).json({ success: true, message: "Monthly report generated.", data: report });
    } catch (error) { next(error); }
  }

  // GET /attendance/report/export-excel?month=2026-04
  static async exportExcel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const month = req.query.month as string;
      if (!month) throw new ApiError(400, "month query param is required");

      const userId = req.user!.role === "employee" ? req.user!._id.toString() : (req.query.userId as string);
      const report = await AttendanceService.getMonthlyReport(month, userId);

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
      res.setHeader("Content-Disposition", `attachment; filename=attendance-${month}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) { next(error); }
  }

  // GET /attendance/report/export-pdf?month=2026-04
  static async exportPdf(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const month = req.query.month as string;
      if (!month) throw new ApiError(400, "month query param is required");

      const userId = req.user!.role === "employee" ? req.user!._id.toString() : (req.query.userId as string);
      const report = await AttendanceService.getMonthlyReport(month, userId);

      const doc = new PDFDocument({ size: "A4", margin: 40 });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=attendance-${month}.pdf`);
      doc.pipe(res);

      // Header
      doc.rect(0, 0, 595.28, 70).fill("#4F46E5");
      doc.fontSize(20).fillColor("#FFFFFF").text("Monthly Attendance Report", 40, 20);
      doc.fontSize(11).text(`United Nexa Tech — ${report.month}`, 40, 45);

      doc.moveDown(2);
      let y = 90;

      // Summary Table
      doc.fillColor("#111827").fontSize(14).text("Employee Summary", 40, y);
      y += 25;

      // Table header
      const cols = [40, 170, 280, 330, 370, 410, 460, 520];
      const headers = ["Employee", "Department", "Present", "Late", "Half", "Absent", "Hours"];

      doc.rect(40, y, 515, 22).fill("#F3F4F6");
      doc.fillColor("#4B5563").fontSize(9).font("Helvetica-Bold");
      headers.forEach((h, i) => doc.text(h, cols[i], y + 6, { width: 60 }));
      y += 22;

      doc.font("Helvetica").fontSize(9).fillColor("#374151");
      for (const emp of report.employees) {
        if (y > 750) {
          doc.addPage();
          y = 40;
        }
        const row = [
          emp.name,
          emp.department || "—",
          String(emp.presentDays),
          String(emp.lateDays),
          String(emp.halfDays),
          String(emp.absentDays),
          emp.totalHours.toFixed(1) + "h",
        ];
        row.forEach((val, i) => doc.text(val, cols[i], y + 4, { width: i === 0 ? 120 : 60 }));
        y += 20;
        doc.moveTo(40, y).lineTo(555, y).strokeColor("#E5E7EB").lineWidth(0.5).stroke();
      }

      // Daily Records
      y += 30;
      if (y > 680) { doc.addPage(); y = 40; }
      doc.fillColor("#111827").fontSize(14).font("Helvetica-Bold").text("Daily Records", 40, y);
      y += 25;

      const detailCols = [40, 120, 230, 310, 380, 445, 510];
      const detailHeaders = ["Date", "Employee", "Clock In", "Clock Out", "Hours", "Status"];

      doc.rect(40, y, 515, 22).fill("#F3F4F6");
      doc.fillColor("#4B5563").fontSize(8).font("Helvetica-Bold");
      detailHeaders.forEach((h, i) => doc.text(h, detailCols[i], y + 6, { width: 70 }));
      y += 22;

      doc.font("Helvetica").fontSize(8).fillColor("#374151");
      for (const r of report.allRecords) {
        if (y > 770) {
          doc.addPage();
          y = 40;
        }
        const user = r.userId as any;
        const row = [
          formatDate(r.date),
          user.name || "Unknown",
          formatTime(r.clockIn),
          formatTime(r.clockOut),
          r.totalHours ? r.totalHours.toFixed(1) + "h" : "—",
          r.status,
        ];
        row.forEach((val, i) => doc.text(val, detailCols[i], y + 3, { width: 80 }));
        y += 18;
        doc.moveTo(40, y).lineTo(555, y).strokeColor("#E5E7EB").lineWidth(0.3).stroke();
      }

      // Footer
      doc.fontSize(8).fillColor("#9CA3AF").text(
        `Generated on ${new Date().toLocaleString("en-IN")} — United Nexa Tech Employee Portal`,
        40, doc.page.height - 30,
        { align: "center", width: 515 }
      );

      doc.end();
    } catch (error) { next(error); }
  }
}
