import { Router } from "express";
import { UserController } from "../controllers/userController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";
import { validate } from "../middleware/validate";
import { createUserSchema, updateUserSchema, resetPasswordSchema, bulkActionSchema } from "../validations/userValidation";

const router = Router();

router.use(authenticate as any);

router.get("/", authorize("admin", "manager") as any, UserController.getAll);
router.post(
  "/",
  authorize("admin") as any,
  validate(createUserSchema),
  UserController.create as any,
);
router.post(
  "/bulk-action",
  authorize("admin") as any,
  validate(bulkActionSchema),
  UserController.bulkAction as any,
);
router.get("/:id", authorize("admin", "manager") as any, UserController.getById);
router.put(
  "/:id",
  authorize("admin") as any,
  validate(updateUserSchema),
  UserController.update
);
router.put(
  "/:id/password",
  authorize("admin") as any,
  validate(resetPasswordSchema),
  UserController.resetPassword as any,
);
router.delete("/:id", authorize("admin") as any, UserController.delete);

export default router;
