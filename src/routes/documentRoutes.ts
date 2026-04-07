import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { DocumentController } from "../controllers/documentController";
import { authenticate } from "../middleware/auth";

// Use /tmp on serverless (read-only fs), uploads/ otherwise
const isServerless = !!process.env.LAMBDA_TASK_ROOT || !!process.env.VERCEL;
const UPLOAD_DIR = isServerless ? "/tmp/uploads" : path.join(process.cwd(), "uploads");

// Ensure upload directory exists at startup
try {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (e) {
  console.error("Failed to create upload directory:", e);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Multer error wrapper: ensures errors return JSON (so CORS headers are sent)
const handleUpload = (req: Request, res: Response, next: NextFunction) => {
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(status).json({
        success: false,
        message: err.message || "File upload failed.",
        code: err.code,
      });
    }
    next();
  });
};

const router = Router();

router.use(authenticate as any);

router.post("/", handleUpload, DocumentController.upload as any);
router.get("/", DocumentController.getAll as any);
router.get("/:id", DocumentController.getById as any);
router.get("/:id/download", DocumentController.download as any);
router.delete("/:id", DocumentController.delete as any);

export default router;
