import { Router } from "express";
import { AttendanceController } from "../controllers/attendanceController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";

const router = Router();

router.use(authenticate as any);

router.post("/clock-in", AttendanceController.clockIn as any);
router.post("/clock-out", AttendanceController.clockOut as any);
router.get("/my-today", AttendanceController.getMyToday as any);
router.get("/my-history", AttendanceController.getMyHistory as any);
router.get(
  "/",
  authorize("admin", "manager") as any,
  AttendanceController.getAll as any
);

export default router;
