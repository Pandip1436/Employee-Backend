import { Router } from "express";
import { RecognitionController } from "../controllers/recognitionController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";

const router = Router();
router.use(authenticate as any);

router.get("/", RecognitionController.getAll as any);
router.post("/", authorize("admin") as any, RecognitionController.create as any);
router.patch("/:id", authorize("admin") as any, RecognitionController.update as any);
router.delete("/:id", authorize("admin") as any, RecognitionController.remove as any);
router.post("/:id/react", RecognitionController.react as any);
router.post("/:id/comment", RecognitionController.addComment as any);

export default router;
