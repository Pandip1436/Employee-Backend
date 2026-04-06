import Conversation from "../models/Conversation";
import Message from "../models/Message";
import { PaginatedResult } from "../types";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";

export class ChatService {
  static async getOrCreateDirectChat(userId1: string, userId2: string) {
    if (userId1 === userId2) {
      throw new ApiError(400, "Cannot create a conversation with yourself.");
    }

    let conversation = await Conversation.findOne({
      type: "direct",
      participants: { $all: [userId1, userId2], $size: 2 },
    }).populate("participants", "name email department");

    if (!conversation) {
      conversation = await Conversation.create({
        type: "direct",
        participants: [userId1, userId2],
        createdBy: userId1,
      });
      conversation = await conversation.populate(
        "participants",
        "name email department"
      );
    }

    return conversation;
  }

  static async createGroupChat(
    creatorId: string,
    name: string,
    participantIds: string[]
  ) {
    if (!name || !name.trim()) {
      throw new ApiError(400, "Group name is required.");
    }

    const participants = Array.from(new Set([creatorId, ...participantIds]));

    const conversation = await Conversation.create({
      type: "group",
      name: name.trim(),
      participants,
      createdBy: creatorId,
    });

    return await conversation.populate("participants", "name email department");
  }

  static async getMyConversations(userId: string) {
    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "name email department")
      .sort({ updatedAt: -1 });

    return conversations;
  }

  static async sendMessage(
    conversationId: string,
    senderId: string,
    text: string
  ) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new ApiError(404, "Conversation not found.");
    }

    const isParticipant = conversation.participants.some(
      (p: any) => p.toString() === senderId
    );
    if (!isParticipant) {
      throw new ApiError(403, "You are not a participant in this conversation.");
    }

    const message = await Message.create({
      conversationId,
      senderId,
      text,
      readBy: [senderId],
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: {
        text,
        senderId,
        createdAt: message.createdAt,
      },
    });

    return await message.populate("senderId", "name email");
  }

  static async getMessages(
    conversationId: string,
    userId: string,
    query: { page?: number; limit?: number }
  ): Promise<PaginatedResult<any>> {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new ApiError(404, "Conversation not found.");
    }

    const isParticipant = conversation.participants.some(
      (p: any) => p.toString() === userId
    );
    if (!isParticipant) {
      throw new ApiError(403, "You are not a participant in this conversation.");
    }

    const { page, limit, skip } = parsePagination(query);

    const filter = { conversationId };

    const [data, total] = await Promise.all([
      Message.find(filter)
        .populate("senderId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Message.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  static async addParticipants(
    conversationId: string,
    userId: string,
    participantIds: string[]
  ) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new ApiError(404, "Conversation not found.");
    }

    if (conversation.type !== "group") {
      throw new ApiError(400, "Can only add participants to group chats.");
    }

    const isParticipant = conversation.participants.some(
      (p: any) => p.toString() === userId
    );
    if (!isParticipant) {
      throw new ApiError(403, "You are not a participant in this conversation.");
    }

    const updated = await Conversation.findByIdAndUpdate(
      conversationId,
      { $addToSet: { participants: { $each: participantIds } } },
      { new: true }
    ).populate("participants", "name email department");

    return updated;
  }

  static async markAsRead(conversationId: string, userId: string) {
    await Message.updateMany(
      {
        conversationId,
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId } }
    );
  }

  static async getUnreadCount(userId: string) {
    const conversations = await Conversation.find({
      participants: userId,
    }).select("_id");

    const conversationIds = conversations.map((c) => c._id);

    const count = await Message.countDocuments({
      conversationId: { $in: conversationIds },
      senderId: { $ne: userId },
      readBy: { $ne: userId },
    });

    return count;
  }
}
