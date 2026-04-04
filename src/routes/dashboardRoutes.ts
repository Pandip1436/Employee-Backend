import { Router } from "express";
import { DashboardController } from "../controllers/dashboardController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";

const router = Router();
router.use(authenticate as any);

router.get("/employee-kpis", DashboardController.getEmployeeKpis as any);
router.get("/upcoming-events", DashboardController.getUpcomingEvents as any);
router.get("/manager-stats", authorize("admin", "manager") as any, DashboardController.getManagerStats as any);
router.get("/pending-approvals", authorize("admin", "manager") as any, DashboardController.getPendingApprovals as any);
router.get("/team-leave-calendar", authorize("admin", "manager") as any, DashboardController.getTeamLeaveCalendar as any);
router.get("/hr-stats", authorize("admin") as any, DashboardController.getHrStats as any);

export default router;
