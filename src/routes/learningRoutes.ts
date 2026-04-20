import { Router } from "express";
import { LearningController } from "../controllers/learningController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";

const router = Router();
router.use(authenticate as any);

// Courses
router.get("/courses", LearningController.getCourses as any);
router.get("/courses/:id", LearningController.getCourseById as any);
router.post("/courses", LearningController.createCourse as any);
router.put("/courses/:id", LearningController.updateCourse as any);
router.delete("/courses/:id", LearningController.deleteCourse as any);
router.post("/courses/:id/enroll", LearningController.enrollCourse as any);
router.post("/courses/:id/complete", LearningController.completeCourse as any);

// Certifications
router.get("/certifications", LearningController.getMyCertifications as any);
router.post("/certifications", LearningController.addCertification as any);

// Training
router.get("/trainings", LearningController.getTrainings as any);
router.post("/trainings", authorize("admin", "manager") as any, LearningController.createTraining as any);
router.get("/calendar", LearningController.getCalendar as any);

// Admin: all learners with enrollment details
router.get("/learners", authorize("admin", "manager") as any, LearningController.getLearners as any);

export default router;
