import { Router } from "express";
import { TimesheetController } from "../controllers/timesheetController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";
import { validate } from "../middleware/validate";
import {
  createTimesheetSchema,
  updateTimesheetSchema,
  approvalSchema,
} from "../validations/timesheetValidation";

const router = Router();

router.use(authenticate as any);

router.post(
  "/",
  validate(createTimesheetSchema),
  TimesheetController.create as any
);
router.get("/", TimesheetController.getAll as any);
router.get("/:id", TimesheetController.getById as any);
router.put(
  "/:id",
  validate(updateTimesheetSchema),
  TimesheetController.update as any
);
router.delete("/:id", TimesheetController.delete as any);

// Workflow
router.patch("/:id/submit", TimesheetController.submit as any);
router.patch(
  "/:id/approve",
  authorize("admin", "manager") as any,
  validate(approvalSchema),
  TimesheetController.approve as any
);

export default router;
