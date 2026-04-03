import { Router } from "express";
import multer from "multer";
import path from "path";
import { EmployeeProfileController } from "../controllers/employeeProfileController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads/"),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();
router.use(authenticate as any);

router.get("/me", EmployeeProfileController.getMyProfile as any);
router.put("/me", EmployeeProfileController.updateMyProfile as any);
router.post("/me/photo", upload.single("photo"), EmployeeProfileController.uploadPhoto as any);
router.post("/me/offer-letter", upload.single("file"), EmployeeProfileController.uploadOfferLetter as any);
router.post("/me/certificates", upload.array("files", 10), EmployeeProfileController.uploadCertificates as any);

// Admin/Manager view any employee profile
router.get("/:id", authorize("admin", "manager") as any, EmployeeProfileController.getByUserId as any);

export default router;
