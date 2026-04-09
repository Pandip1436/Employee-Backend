import { Router } from "express";
import { WeeklyTimesheetController } from "../controllers/weeklyTimesheetController";
import { ConfigController } from "../controllers/configController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";

const router = Router();
router.use(authenticate as any);

// Employee
router.get("/current", WeeklyTimesheetController.getCurrentWeek as any);
router.post("/save", WeeklyTimesheetController.saveEntries as any);
router.patch("/:id/submit", WeeklyTimesheetController.submit as any);
router.get("/history", WeeklyTimesheetController.getMyHistory as any);
router.get("/detail/:id", WeeklyTimesheetController.getById as any);

// Manager
router.get("/approvals", authorize("admin", "manager") as any, WeeklyTimesheetController.getPendingApprovals as any);
router.patch("/:id/approve", authorize("admin", "manager") as any, WeeklyTimesheetController.approve as any);
router.get("/project-summary", authorize("admin", "manager") as any, WeeklyTimesheetController.getProjectSummary as any);

// Admin
router.get("/all", authorize("admin") as any, WeeklyTimesheetController.getAllSheets as any);
router.get("/dashboard-stats", authorize("admin", "manager") as any, WeeklyTimesheetController.getDashboardStats as any);
router.get("/missing", authorize("admin", "manager") as any, WeeklyTimesheetController.getMissing as any);
router.get("/overtime", authorize("admin", "manager") as any, WeeklyTimesheetController.getOvertimeReport as any);
router.post("/reminders/send", authorize("admin") as any, WeeklyTimesheetController.sendReminders as any);
router.get("/compliance", authorize("admin", "manager") as any, WeeklyTimesheetController.getCompliance as any);
router.get("/employees-status", authorize("admin", "manager") as any, WeeklyTimesheetController.getEmployeeTimesheetStatus as any);

// Config
router.get("/activity-types", ConfigController.getActivityTypes as any);
router.post("/activity-types", authorize("admin") as any, ConfigController.createActivityType as any);
router.delete("/activity-types/:id", authorize("admin") as any, ConfigController.deleteActivityType as any);
router.get("/policies", ConfigController.getPolicies as any);
router.put("/policies", authorize("admin") as any, ConfigController.upsertPolicy as any);

export default router;
