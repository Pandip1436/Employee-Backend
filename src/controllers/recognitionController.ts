import { Response, NextFunction } from "express";
import Recognition from "../models/Recognition";
import { AuthRequest } from "../types";
import { parsePagination } from "../utils/helpers";

export class RecognitionController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, skip } = parsePagination(req.query as any);
      const [data, total] = await Promise.all([
        Recognition.find().populate("fromUser", "name email department").populate("toUser", "name email department").populate("comments.userId", "name").sort("-createdAt").skip(skip).limit(limit),
        Recognition.countDocuments(),
      ]);
      res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    } catch (e) { next(e); }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rec = await Recognition.create({ ...req.body, fromUser: req.user!._id });
      const populated = await Recognition.findById(rec._id).populate("fromUser", "name email").populate("toUser", "name email");
      res.status(201).json({ success: true, data: populated });
    } catch (e) { next(e); }
  }

  static async react(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rec = await Recognition.findById(req.params.id as string);
      if (!rec) { res.status(404).json({ success: false, message: "Not found." }); return; }
      const userId = req.user!._id;
      if (rec.reactions?.like?.some((id: any) => id.toString() === userId.toString())) {
        await Recognition.findByIdAndUpdate(rec._id, { $pull: { "reactions.like": userId } });
      } else {
        await Recognition.findByIdAndUpdate(rec._id, { $addToSet: { "reactions.like": userId } });
      }
      res.json({ success: true });
    } catch (e) { next(e); }
  }

  static async addComment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rec = await Recognition.findByIdAndUpdate(
        req.params.id as string,
        { $push: { comments: { userId: req.user!._id, text: req.body.text } } },
        { new: true }
      ).populate("comments.userId", "name");
      res.json({ success: true, data: rec });
    } catch (e) { next(e); }
  }
}
