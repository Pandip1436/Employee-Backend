import { Router } from "express";
import { RecognitionController } from "../controllers/recognitionController";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate as any);

router.get("/", RecognitionController.getAll as any);
router.post("/", RecognitionController.create as any);
router.post("/:id/react", RecognitionController.react as any);
router.post("/:id/comment", RecognitionController.addComment as any);

export default router;
