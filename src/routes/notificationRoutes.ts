import { Router } from "express";
import { NotificationController } from "../controllers/notificationController";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate as any);

router.get("/", NotificationController.list as any);
router.get("/unread-count", NotificationController.unreadCount as any);
router.patch("/:id/read", NotificationController.markRead as any);
router.patch("/read-all", NotificationController.markAllRead as any);
router.delete("/:id", NotificationController.remove as any);

export default router;
