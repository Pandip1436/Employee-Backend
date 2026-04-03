import { Router } from "express";
import { TimerController } from "../controllers/timerController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { startTimerSchema } from "../validations/timerValidation";

const router = Router();

router.use(authenticate as any);

router.post("/start", validate(startTimerSchema), TimerController.start as any);
router.patch("/:id/stop", TimerController.stop as any);
router.get("/running", TimerController.getRunning as any);
router.get("/history", TimerController.getHistory as any);

export default router;
