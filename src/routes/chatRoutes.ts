import { Router } from "express";
import { ChatController } from "../controllers/chatController";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate as any);

// Conversations
router.post("/direct", ChatController.getOrCreateDirect as any);
router.post("/group", ChatController.createGroup as any);
router.get("/conversations", ChatController.getMyConversations as any);
router.get("/unread-count", ChatController.getUnreadCount as any);

// Messages (dynamic routes after static)
router.post("/:conversationId/messages", ChatController.sendMessage as any);
router.get("/:conversationId/messages", ChatController.getMessages as any);
router.post("/:conversationId/participants", ChatController.addParticipants as any);
router.patch("/:conversationId/read", ChatController.markAsRead as any);

export default router;
