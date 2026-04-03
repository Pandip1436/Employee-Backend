import { Router } from "express";
import { WfhController } from "../controllers/wfhController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";

const router = Router();
router.use(authenticate as any);

router.post("/", WfhController.apply as any);
router.get("/my", WfhController.getMyRequests as any);
router.get("/", authorize("admin", "manager") as any, WfhController.getAll as any);
router.patch("/:id/approve", authorize("admin", "manager") as any, WfhController.approve as any);
router.delete("/:id", WfhController.delete as any);

export default router;
