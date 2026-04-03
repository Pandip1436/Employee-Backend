import { Router } from "express";
import { AuthController } from "../controllers/authController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { registerSchema, loginSchema, updateProfileSchema, changePasswordSchema } from "../validations/authValidation";

const router = Router();

router.post("/register", validate(registerSchema), AuthController.register);
router.post("/login", validate(loginSchema), AuthController.login);
router.get("/me", authenticate, AuthController.getMe as any);
router.post("/logout", authenticate, AuthController.logout as any);
router.put("/profile", authenticate, validate(updateProfileSchema), AuthController.updateProfile as any);
router.put("/change-password", authenticate, validate(changePasswordSchema), AuthController.changePassword as any);

export default router;
