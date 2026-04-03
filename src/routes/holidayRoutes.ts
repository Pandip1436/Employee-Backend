import { Router } from "express";
import { HolidayController } from "../controllers/holidayController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";

const router = Router();
router.use(authenticate as any);

router.get("/", HolidayController.getAll as any);
router.post("/", authorize("admin") as any, HolidayController.create as any);
router.delete("/:id", authorize("admin") as any, HolidayController.delete as any);

export default router;
