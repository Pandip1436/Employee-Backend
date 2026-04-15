import { Types } from "mongoose";
import Notification from "../models/Notification";
import User from "../models/User";

export interface CreateNotificationInput {
  recipient: string | Types.ObjectId;
  sender?: string | Types.ObjectId;
  type:
    | "announcement"
    | "leave"
    | "timesheet"
    | "wfh"
    | "compoff"
    | "recognition"
    | "chat"
    | "document"
    | "system";
  title: string;
  message: string;
  link?: string;
  entityType?: string;
  entityId?: string | Types.ObjectId;
}

export class NotificationService {
  static async create(input: CreateNotificationInput) {
    return Notification.create(input);
  }

  static async createMany(inputs: CreateNotificationInput[]) {
    if (!inputs.length) return [];
    return Notification.insertMany(inputs);
  }

  static async notifyAll(input: Omit<CreateNotificationInput, "recipient">, excludeUserId?: string | Types.ObjectId) {
    const filter: Record<string, unknown> = { isActive: true };
    if (excludeUserId) filter._id = { $ne: excludeUserId };
    const users = await User.find(filter).select("_id");
    const docs = users.map((u) => ({ ...input, recipient: u._id }));
    return this.createMany(docs);
  }

  static async notifyApprovers(input: Omit<CreateNotificationInput, "recipient">, excludeUserId?: string | Types.ObjectId) {
    const filter: Record<string, unknown> = { isActive: true, role: { $in: ["admin", "manager"] } };
    if (excludeUserId) filter._id = { $ne: excludeUserId };
    const users = await User.find(filter).select("_id");
    const docs = users.map((u) => ({ ...input, recipient: u._id }));
    return this.createMany(docs);
  }

  static async list(userId: string | Types.ObjectId, opts: { page: number; limit: number; unreadOnly?: boolean }) {
    const filter: Record<string, unknown> = { recipient: userId };
    if (opts.unreadOnly) filter.isRead = false;
    const skip = (opts.page - 1) * opts.limit;
    const [data, total, unread] = await Promise.all([
      Notification.find(filter)
        .populate("sender", "name email")
        .sort("-createdAt")
        .skip(skip)
        .limit(opts.limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: userId, isRead: false }),
    ]);
    return { data, total, unread, page: opts.page, limit: opts.limit };
  }

  static async markRead(userId: string | Types.ObjectId, id: string) {
    return Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
  }

  static async markAllRead(userId: string | Types.ObjectId) {
    return Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
  }

  static async remove(userId: string | Types.ObjectId, id: string) {
    return Notification.findOneAndDelete({ _id: id, recipient: userId });
  }

  static async unreadCount(userId: string | Types.ObjectId) {
    return Notification.countDocuments({ recipient: userId, isRead: false });
  }
}
