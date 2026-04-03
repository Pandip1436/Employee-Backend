import Holiday from "../models/Holiday";
import { ApiError } from "../utils/ApiError";

export class HolidayService {
  static async create(data: { name: string; date: string; type?: string; description?: string }) {
    return Holiday.create(data);
  }

  static async getAll(year?: number) {
    const filter: Record<string, unknown> = {};
    if (year) {
      filter.date = { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31) };
    }
    return Holiday.find(filter).sort("date").lean();
  }

  static async delete(id: string) {
    const h = await Holiday.findByIdAndDelete(id);
    if (!h) throw new ApiError(404, "Holiday not found.");
  }
}
