import { Router } from "express";
import { InternController } from "../controllers/internController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";
import { validate } from "../middleware/validate";
import {
  createInternSchema,
  sendCertificateSchema,
  updateInternSchema,
} from "../validations/internValidation";
import { resetPasswordSchema } from "../validations/userValidation";

const router = Router();

router.use(authenticate as any);

// Managers can browse the intern directory; only admins can change it.
router.get("/", authorize("admin", "manager") as any, InternController.getAll as any);
router.get("/stats", authorize("admin", "manager") as any, InternController.getStats as any);
router.get("/mentors", authorize("admin", "manager") as any, InternController.getMentors as any);

router.post(
  "/",
  authorize("admin") as any,
  validate(createInternSchema),
  InternController.create as any,
);

router.get("/:id", authorize("admin", "manager") as any, InternController.getById as any);

router.put(
  "/:id",
  authorize("admin") as any,
  validate(updateInternSchema),
  InternController.update as any,
);

router.put(
  "/:id/password",
  authorize("admin") as any,
  validate(resetPasswordSchema),
  InternController.resetPassword as any,
);

// Managers may view/download a certificate; only admins can email it out.
router.get(
  "/:id/certificate",
  authorize("admin", "manager") as any,
  InternController.getCertificate as any,
);

router.post(
  "/:id/certificate/send",
  authorize("admin") as any,
  validate(sendCertificateSchema),
  InternController.sendCertificate as any,
);

router.delete("/:id", authorize("admin") as any, InternController.delete as any);

export default router;
