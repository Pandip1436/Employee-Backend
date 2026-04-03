import { Router } from "express";
import multer from "multer";
import path from "path";
import { DocumentController } from "../controllers/documentController";
import { authenticate } from "../middleware/auth";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads/"),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const router = Router();

router.use(authenticate as any);

router.post("/", upload.single("file"), DocumentController.upload as any);
router.get("/", DocumentController.getAll as any);
router.get("/:id", DocumentController.getById as any);
router.get("/:id/download", DocumentController.download as any);
router.delete("/:id", DocumentController.delete as any);

export default router;
