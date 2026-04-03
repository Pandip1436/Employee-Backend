import { Router } from "express";
import { CompOffController } from "../controllers/compOffController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";

const router = Router();
router.use(authenticate as any);

router.post("/", CompOffController.apply as any);
router.get("/my", CompOffController.getMyRequests as any);
router.get("/balance", CompOffController.getBalance as any);
router.get("/", authorize("admin", "manager") as any, CompOffController.getAll as any);
router.patch("/:id/approve", authorize("admin", "manager") as any, CompOffController.approve as any);
router.delete("/:id", CompOffController.delete as any);

export default router;
