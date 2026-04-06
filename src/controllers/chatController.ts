import { Response, NextFunction } from "express";
import { ChatService } from "../services/chatService";
import { AuthRequest } from "../types";

export class ChatController {
  static async getOrCreateDirect(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const conversation = await ChatService.getOrCreateDirectChat(
        req.user!._id.toString(),
        req.body.userId
      );
      res.status(200).json({
        success: true,
        message: "Direct conversation fetched successfully.",
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createGroup(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const conversation = await ChatService.createGroupChat(
        req.user!._id.toString(),
        req.body.name,
        req.body.participants
      );
      res.status(201).json({
        success: true,
        message: "Group conversation created successfully.",
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyConversations(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const conversations = await ChatService.getMyConversations(
        req.user!._id.toString()
      );
      res.status(200).json({
        success: true,
        message: "Conversations fetched successfully.",
        data: conversations,
      });
    } catch (error) {
      next(error);
    }
  }

  static async sendMessage(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const message = await ChatService.sendMessage(
        req.params.conversationId,
        req.user!._id.toString(),
        req.body.text
      );
      res.status(201).json({
        success: true,
        message: "Message sent successfully.",
        data: message,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMessages(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await ChatService.getMessages(
        req.params.conversationId,
        req.user!._id.toString(),
        req.query as any
      );
      res.status(200).json({
        success: true,
        message: "Messages fetched successfully.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async addParticipants(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const conversation = await ChatService.addParticipants(
        req.params.conversationId,
        req.user!._id.toString(),
        req.body.participants
      );
      res.status(200).json({
        success: true,
        message: "Participants added successfully.",
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteMessage(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await ChatService.deleteMessage(
        req.params.messageId,
        req.user!._id.toString()
      );
      res.status(200).json({
        success: true,
        message: "Message deleted.",
      });
    } catch (error) {
      next(error);
    }
  }

  static async markAsRead(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await ChatService.markAsRead(
        req.params.conversationId,
        req.user!._id.toString()
      );
      res.status(200).json({
        success: true,
        message: "Messages marked as read.",
      });
    } catch (error) {
      next(error);
    }
  }

  static async getChatUsers(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const users = await ChatService.getChatUsers(req.user!._id.toString());
      res.status(200).json({
        success: true,
        message: "Chat users fetched.",
        data: users,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUnreadCount(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const total = await ChatService.getUnreadCount(
        req.user!._id.toString()
      );
      res.status(200).json({
        success: true,
        message: "Unread count fetched successfully.",
        data: { total },
      });
    } catch (error) {
      next(error);
    }
  }
}
