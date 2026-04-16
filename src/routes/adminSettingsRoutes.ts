import { Router } from "express";
import { AdminSettingsController } from "../controllers/adminSettingsController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";

const router = Router();
router.use(authenticate as any);
router.use(authorize("admin") as any);

router.get("/company", AdminSettingsController.getCompanySettings as any);
router.put("/company", AdminSettingsController.updateCompanySettings as any);
router.get("/departments", AdminSettingsController.getDepartments as any);
router.put("/departments", AdminSettingsController.updateDepartments as any);
router.get("/designations", AdminSettingsController.getDesignations as any);
router.put("/designations", AdminSettingsController.updateDesignations as any);
router.get("/roles", AdminSettingsController.getRoles as any);
router.get("/roles/user-counts", AdminSettingsController.getRoleUserCounts as any);
router.put("/roles", AdminSettingsController.updateRoles as any);
router.get("/leave-policy", AdminSettingsController.getLeavePolicy as any);
router.put("/leave-policy", AdminSettingsController.updateLeavePolicy as any);
router.get("/email-templates", AdminSettingsController.getEmailTemplates as any);
router.put("/email-templates", AdminSettingsController.updateEmailTemplates as any);
router.get("/audit-logs", AdminSettingsController.getAuditLogs as any);

export default router;
