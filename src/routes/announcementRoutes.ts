import { Router } from "express";
import { AnnouncementController } from "../controllers/announcementController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleAuth";

const router = Router();
router.use(authenticate as any);

router.get("/", AnnouncementController.getAll as any);
router.get("/:id", AnnouncementController.getById as any);
router.post("/", authorize("admin", "manager") as any, AnnouncementController.create as any);
router.put("/:id", authorize("admin", "manager") as any, AnnouncementController.update as any);
router.delete("/:id", authorize("admin") as any, AnnouncementController.delete as any);
router.post("/:id/react", AnnouncementController.react as any);
router.post("/:id/comment", AnnouncementController.addComment as any);

export default router;
