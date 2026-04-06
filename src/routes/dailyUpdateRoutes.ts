import { Router } from "express";
import { DailyUpdateController } from "../controllers/dailyUpdateController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";

const router = Router();
router.use(authenticate as any);

// Static routes first
router.post("/", DailyUpdateController.create as any);
router.get("/my", DailyUpdateController.getMyUpdates as any);
router.get("/team/all", authorize("admin", "manager") as any, DailyUpdateController.getTeamUpdates as any);

// Dynamic routes after
router.get("/:id", DailyUpdateController.getById as any);
router.put("/:id", DailyUpdateController.update as any);
router.delete("/:id", DailyUpdateController.delete as any);

export default router;
