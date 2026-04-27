import { Router } from "express";
import { AttendanceController } from "../controllers/attendanceController";
import { AttendanceReportController } from "../controllers/attendanceReportController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";

const router = Router();

router.use(authenticate as any);

router.post("/clock-in", AttendanceController.clockIn as any);
router.post("/clock-out", AttendanceController.clockOut as any);
router.get("/my-today", AttendanceController.getMyToday as any);
router.get("/my-history", AttendanceController.getMyHistory as any);

// Per-user auto clock-out preference
router.get("/preferences", AttendanceController.getPreferences as any);
router.put("/preferences", AttendanceController.updatePreferences as any);

// Admin: backfill absent records for a past date range
router.post(
  "/mark-absent",
  authorize("admin") as any,
  AttendanceController.markAbsentBackfill as any
);

// Live status — admin/manager only
router.get(
  "/live-status",
  authorize("admin", "manager") as any,
  AttendanceController.getTodayLiveStatus as any
);

// Reports — must be before "/:id" style routes
router.get("/report/monthly", AttendanceReportController.getMonthlyReport as any);
router.get("/report/export-excel", AttendanceReportController.exportExcel as any);
router.get("/report/export-pdf", AttendanceReportController.exportPdf as any);

router.get(
  "/",
  authorize("admin", "manager") as any,
  AttendanceController.getAll as any
);

export default router;
