import { Router } from "express";
import { PerformanceController } from "../controllers/performanceController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";

const router = Router();
router.use(authenticate as any);

// Goals
router.get("/goals", PerformanceController.getGoals as any);
router.post("/goals", PerformanceController.createGoal as any);
router.put("/goals/:id", PerformanceController.updateGoal as any);
router.delete("/goals/:id", PerformanceController.deleteGoal as any);

// Reviews
router.get("/reviews/my", PerformanceController.getMyReviews as any);
router.get("/reviews/team", authorize("admin", "manager") as any, PerformanceController.getTeamReviews as any);
router.get("/reviews/:id", PerformanceController.getReview as any);
router.post("/reviews/:id/self", PerformanceController.submitSelfReview as any);
router.post("/reviews/:id/manager", authorize("admin", "manager") as any, PerformanceController.submitManagerReview as any);

// Feedback
router.post("/feedback", PerformanceController.giveFeedback as any);
router.get("/feedback/my", PerformanceController.getMyFeedback as any);
router.get("/feedback/:userId", authorize("admin", "manager") as any, PerformanceController.getFeedbackFor as any);

// PIP
router.get("/pip", authorize("admin", "manager") as any, PerformanceController.getAllPIPs as any);
router.get("/pip/:id", PerformanceController.getPIP as any);
router.post("/pip", authorize("admin", "manager") as any, PerformanceController.createPIP as any);
router.put("/pip/:id", authorize("admin", "manager") as any, PerformanceController.updatePIP as any);

// Cycles
router.get("/cycles", PerformanceController.getCycles as any);
router.post("/cycles", authorize("admin") as any, PerformanceController.createCycle as any);
router.put("/cycles/:id", authorize("admin") as any, PerformanceController.updateCycle as any);

// Calibration
router.get("/calibrate", authorize("admin") as any, PerformanceController.getCalibrationData as any);
router.post("/calibrate", authorize("admin") as any, PerformanceController.calibrate as any);

export default router;
