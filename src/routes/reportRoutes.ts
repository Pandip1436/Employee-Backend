import { Router } from "express";
import { ReportController } from "../controllers/reportController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";

const router = Router();

router.use(authenticate as any);

router.get(
  "/employee",
  authorize("admin", "manager") as any,
  ReportController.getEmployeeReport as any
);
router.get(
  "/project",
  authorize("admin", "manager") as any,
  ReportController.getProjectReport as any
);
router.get("/weekly-summary", ReportController.getWeeklySummary as any);

export default router;
