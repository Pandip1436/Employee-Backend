import { Response, NextFunction } from "express";
import { HolidayService } from "../services/holidayService";
import { AuthRequest } from "../types";

export class HolidayController {
  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const holiday = await HolidayService.create(req.body);
      res.status(201).json({ success: true, message: "Holiday created.", data: holiday });
    } catch (error) { next(error); }
  }

  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const year = req.query.year ? Number(req.query.year) : undefined;
      const holidays = await HolidayService.getAll(year);
      res.status(200).json({ success: true, message: "Holidays fetched.", data: holidays });
    } catch (error) { next(error); }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await HolidayService.delete(req.params.id as string);
      res.status(200).json({ success: true, message: "Holiday deleted." });
    } catch (error) { next(error); }
  }
}
