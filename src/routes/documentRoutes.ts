import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { DocumentController } from "../controllers/documentController";
import { authenticate } from "../middleware/auth";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

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
