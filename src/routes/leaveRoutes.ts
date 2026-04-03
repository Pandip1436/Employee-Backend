import { Router } from "express";
import { LeaveController } from "../controllers/leaveController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";
import { validate } from "../middleware/validate";
import { applyLeaveSchema, leaveApprovalSchema } from "../validations/leaveValidation";

const router = Router();

router.use(authenticate as any);

router.post("/", validate(applyLeaveSchema), LeaveController.apply as any);
router.get("/my", LeaveController.getMyLeaves as any);
router.get("/balance", LeaveController.getBalance as any);
router.get(
  "/",
  authorize("admin", "manager") as any,
  LeaveController.getAll as any
);
router.patch(
  "/:id/approve",
  authorize("admin", "manager") as any,
  validate(leaveApprovalSchema),
  LeaveController.approve as any
);
router.delete("/:id", LeaveController.delete as any);

export default router;
