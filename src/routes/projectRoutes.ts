import { Router } from "express";
import { ProjectController } from "../controllers/projectController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";
import { validate } from "../middleware/validate";
import {
  createProjectSchema,
  updateProjectSchema,
} from "../validations/projectValidation";

const router = Router();

router.use(authenticate as any);

router.post(
  "/",
  authorize("admin", "manager") as any,
  validate(createProjectSchema),
  ProjectController.create as any
);
router.get("/", ProjectController.getAll as any);
router.get("/:id", ProjectController.getById as any);
router.put(
  "/:id",
  authorize("admin", "manager") as any,
  validate(updateProjectSchema),
  ProjectController.update as any
);
router.delete(
  "/:id",
  authorize("admin") as any,
  ProjectController.delete as any
);

export default router;
