import { Router } from "express";
import { SurveyController } from "../controllers/surveyController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";

const router = Router();
router.use(authenticate as any);

router.get("/", SurveyController.getAll as any);
router.get("/:id", SurveyController.getById as any);
router.post("/", authorize("admin") as any, SurveyController.create as any);
router.post("/:id/submit", SurveyController.submit as any);
router.get("/:id/results", authorize("admin", "manager") as any, SurveyController.getResults as any);
router.delete("/:id", authorize("admin") as any, SurveyController.delete as any);

export default router;
