import { Router } from "express";
import { UserController } from "../controllers/userController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";
import { validate } from "../middleware/validate";
import { updateUserSchema } from "../validations/userValidation";

const router = Router();

router.use(authenticate as any);

router.get("/", authorize("admin", "manager") as any, UserController.getAll);
router.get("/:id", authorize("admin", "manager") as any, UserController.getById);
router.put(
  "/:id",
  authorize("admin") as any,
  validate(updateUserSchema),
  UserController.update
);
router.delete("/:id", authorize("admin") as any, UserController.delete);

export default router;
