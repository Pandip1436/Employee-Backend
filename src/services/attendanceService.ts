import Attendance, { IAttendance } from "../models/Attendance";
import User from "../models/User";
import Holiday from "../models/Holiday";
import Leave from "../models/Leave";
import CompanySettings from "../models/CompanySettings";
import { EmailService } from "./emailService";
import { attachProfilePhotoUrls } from "./userService";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

// True if `dow` (0=Sun..6=Sat) is in the configured working-days list. Tolerates
// both short ("Mon") and full ("Monday") forms because legacy data may use either.
export function isWorkingDow(dow: number, workingDays: string[] | undefined): boolean {
  const list = (workingDays || []).map((d) => d.toLowerCase());
  if (!list.length) return dow >= 1 && dow <= 5; // safe default: Mon–Fri
  return list.includes(DAY_SHORT[dow].toLowerCase()) || list.includes(DAY_FULL[dow].toLowerCase());
}

// How many minutes you must add to a UTC instant to express it in the given IANA tz.
function tzOffsetMinutes(at: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(at)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  const asUtc = Date.UTC(
    +parts.year, +parts.month - 1, +parts.day,
    +parts.hour === 24 ? 0 : +parts.hour, +parts.minute, +parts.second,
  );
  return (asUtc - at.getTime()) / 60000;
}

export class AttendanceService {
  /**
   * Returns midnight "today" in the configured business timezone (default IST).
   * This ensures attendance records are bucketed by the user's calendar day,
   * not the server's local-time day (server may be in UTC).
   */
  static getToday(): Date {
    const tz = process.env.BUSINESS_TIMEZONE || "Asia/Kolkata";
    const now = new Date();
    // Format current instant as YYYY-MM-DD in the business timezone
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const y = Number(parts.find((p) => p.type === "year")?.value);
    const m = Number(parts.find((p) => p.type === "month")?.value);
    const d = Number(parts.find((p) => p.type === "day")?.value);
    // Store as UTC midnight of that calendar date — stable, no DST surprises
    return new Date(Date.UTC(y, m - 1, d));
  }

  /**
   * Returns { officeStart, lateThreshold } as real instants.
   * `officeStart` is the configured "HH:MM" interpreted in the company timezone
   * for the calendar day of `now`. `lateThreshold = officeStart + graceMinutes`.
   */
  private static async getOfficeStartForNow(now: Date): Promise<{ officeStart: Date; lateThreshold: Date }> {
    const settings = await CompanySettings.findOne()
      .select("attendancePolicy timezone")
      .lean();
    const policy = (settings as any)?.attendancePolicy || {};
    const startStr: string = policy.officeStartTime || process.env.OFFICE_START_TIME || "09:00";
    const graceMinutes: number = Number.isFinite(policy.graceMinutes) ? policy.graceMinutes : 0;
    const tz: string = (settings as any)?.timezone || process.env.BUSINESS_TIMEZONE || "Asia/Kolkata";
    const [h, m] = startStr.split(":").map(Number);

    // Find calendar Y-M-D in the company timezone for `now`
    const dtf = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
    });
    const parts: Record<string, string> = {};
    for (const p of dtf.formatToParts(now)) {
      if (p.type !== "literal") parts[p.type] = p.value;
    }
    // Build a candidate UTC moment for (Y, M, D, h, m), then correct by tz offset
    const candidate = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, h, m, 0));
    const officeStart = new Date(candidate.getTime() - tzOffsetMinutes(candidate, tz) * 60000);
    const lateThreshold = new Date(officeStart.getTime() + graceMinutes * 60000);
    return { officeStart, lateThreshold };
  }

  static async clockIn(userId: string, notes?: string) {
    const today = this.getToday();

    const existing = await Attendance.findOne({ userId, date: today });
    if (existing?.clockIn) {
      throw new ApiError(400, "You have already clocked in today.");
    }

    const now = new Date();
    const { officeStart, lateThreshold } = await this.getOfficeStartForNow(now);
    const isLate = now > lateThreshold;
    const status = isLate ? "late" : "present";

    // Calculate late duration in minutes (measured from officeStart, not the grace cutoff)
    let lateByMinutes = 0;
    if (isLate) {
      lateByMinutes = Math.round((now.getTime() - officeStart.getTime()) / 60000);
    }

    const record = existing
      ? existing
      : await Attendance.create({ userId, date: today, clockIn: now, status, notes });

    if (existing) {
      existing.clockIn = now;
      existing.status = status;
      if (notes) existing.notes = notes;
      await existing.save();
    }

    return { ...record.toObject(), isLate, lateByMinutes };
  }

  static async clockOut(userId: string, notes?: string) {
    const today = this.getToday();
    const record = await Attendance.findOne({ userId, date: today });

    if (!record || !record.clockIn) {
      throw new ApiError(400, "You haven't clocked in today.");
    }
    if (record.clockOut) {
      throw new ApiError(400, "You have already clocked out today.");
    }

    const now = new Date();
    record.clockOut = now;
    record.totalHours = parseFloat(
      ((now.getTime() - record.clockIn.getTime()) / 3600000).toFixed(2)
    );

    if (record.totalHours < 4) {
      record.status = "absent";
    } else if (record.totalHours < 5) {
      record.status = "half-day";
    }

    if (notes) record.notes = notes;
    await record.save();
    return record;
  }

  static async getMyToday(userId: string) {
    const today = this.getToday();
    return Attendance.findOne({ userId, date: today });
  }

  static async getAll(query: {
    page?: number;
    limit?: number;
    sort?: string;
    date?: string;
    userId?: string;
    status?: string;
  }) {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter: Record<string, unknown> = {};

    if (query.date) filter.date = new Date(query.date);
    if (query.userId) filter.userId = query.userId;
    if (query.status) filter.status = query.status;

    const [data, total] = await Promise.all([
      Attendance.find(filter)
        .populate("userId", "name email department role")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Attendance.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  static async getTodayLiveStatus(targetDateStr?: string) {
    let dayStart: Date;
    if (targetDateStr) {
      const [y, m, d] = targetDateStr.split("-").map(Number);
      dayStart = new Date(Date.UTC(y, m - 1, d));
    } else {
      dayStart = this.getToday();
    }
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    // Use a date range to be robust to timezone / precision mismatches
    // (records may have been saved with slightly different "midnight" values)
    const records = await Attendance.find({
      date: { $gte: dayStart, $lt: dayEnd },
    })
      .populate("userId", "name email department role userStatus")
      .lean();

    // All active users excluding admins (admins are not required to mark attendance)
    const User = (await import("../models/User")).default;
    const rawUsers = await User.find({ isActive: true, role: { $ne: "admin" } }).select("name email department role userStatus userId").lean();
    const allUsers = (await attachProfilePhotoUrls(rawUsers)) as any[];

    // Approved leaves that cover the target date — used to surface on-leave
    // employees even when the auto-mark cron hasn't created an attendance row yet
    // (e.g. before the cron fires, historical dates, or leaves approved after the
    // cron ran for that date).
    // Compare both bounds against dayStart (target day's UTC midnight). Comparing
    // startDate against dayEnd (= next day's UTC midnight) with $lte was a bug:
    // a leave stored as 08-05 00:00 UTC matched the 07-05 query, marking the
    // employee as on-leave the day before.
    const approvedLeaves = await Leave.find({
      status: "approved",
      startDate: { $lte: dayStart },
      endDate: { $gte: dayStart },
    })
      .select("userId")
      .lean();
    const onLeaveUserIds = new Set(approvedLeaves.map((l) => l.userId.toString()));

    const clockedInMap = new Map(
      records.map((r) => [(r.userId as any)._id.toString(), r])
    );

    const employees = allUsers.map((u) => {
      const userId = u._id.toString();
      const record = clockedInMap.get(userId);
      type LiveStatus =
        | "clocked-in"
        | "clocked-out"
        | "late"
        | "absent"
        | "on-leave"
        | "not-marked";
      let liveStatus: LiveStatus = "not-marked";

      if (record) {
        if (record.status === "on-leave") {
          liveStatus = "on-leave";
        } else if (record.clockIn && !record.clockOut) {
          liveStatus = record.status === "late" ? "late" : "clocked-in";
        } else if (record.clockOut) {
          // half-day is a sub-classification — still surfaces as "logged out" here.
          liveStatus = "clocked-out";
        } else if (record.status === "absent") {
          // Auto-marked absent row (no clock-in)
          liveStatus = "absent";
        }
        // else: row exists but no clockIn/clockOut and non-actionable status -> fall through to not-marked
      }

      // Approved leave overrides not-marked / absent — they were never expected
      // to clock in today. Don't override an actual clock-in or clock-out, which
      // would be evidence of attendance regardless of an open leave.
      if (
        onLeaveUserIds.has(userId) &&
        (liveStatus === "not-marked" || liveStatus === "absent")
      ) {
        liveStatus = "on-leave";
      }

      return {
        _id: u._id,
        userId: (u as any).userId || null,
        name: u.name,
        email: u.email,
        department: u.department,
        role: u.role,
        userStatus: u.userStatus || "online",
        liveStatus,
        clockIn: record?.clockIn || null,
        clockOut: record?.clockOut || null,
        totalHours: record?.totalHours || null,
        status: record?.status || null,
        profilePhotoUrl: u.profilePhotoUrl ?? null,
      };
    });

    const countBy = (s: string) => employees.filter((e) => e.liveStatus === s).length;
    // halfDay is a sub-count within clocked-out, derived from the attendance row's status.
    const halfDay = employees.filter((e) => e.status === "half-day").length;
    const summary = {
      total: allUsers.length,
      clockedIn: countBy("clocked-in"),
      late: countBy("late"),
      clockedOut: countBy("clocked-out"),
      halfDay,
      absent: countBy("absent"),
      onLeave: countBy("on-leave"),
      notMarked: countBy("not-marked"),
    };

    return { summary, employees };
  }

  static async getMyHistory(
    userId: string,
    query: { page?: number; limit?: number; month?: string }
  ) {
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = { userId };

    if (query.month) {
      const [year, month] = query.month.split("-").map(Number);
      filter.date = {
        $gte: new Date(year, month - 1, 1),
        $lt: new Date(year, month, 1),
      };
    }

    const [data, total] = await Promise.all([
      Attendance.find(filter).sort("-date").skip(skip).limit(limit),
      Attendance.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Auto clock-out: closes every open attendance record (clockIn exists, clockOut missing)
   * for today's date. Sets clockOut to the given time and computes totalHours.
   * Called by the 7 PM cron job.
   */
  static async autoClockOutAll() {
    const today = this.getToday();
    const autoTime = new Date();

    // Read the configured auto-clock-out label so the note reflects the current setting
    let autoTimeLabel = "auto clock-out";
    try {
      const settings = await CompanySettings.findOne()
        .select("attendancePolicy")
        .lean();
      const hhmm = (settings as any)?.attendancePolicy?.autoClockOutTime;
      if (hhmm && /^\d{1,2}:\d{2}$/.test(hhmm)) {
        const [hStr, mStr] = hhmm.split(":");
        const h24 = Number(hStr);
        const period = h24 >= 12 ? "PM" : "AM";
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        autoTimeLabel = `${h12}:${mStr} ${period}`;
      }
    } catch { /* fall back to generic label */ }

    // Skip users who opted out of auto clock-out
    const optedOutUsers = await User.find(
      { autoClockOutEnabled: false },
      { _id: 1 }
    ).lean();
    const skipIds = optedOutUsers.map((u) => u._id);

    const openRecords = await Attendance.find({
      date: today,
      clockIn: { $exists: true, $ne: null },
      clockOut: null,
      ...(skipIds.length ? { userId: { $nin: skipIds } } : {}),
    });

    let count = 0;
    const closed: { userId: string; clockIn: Date; clockOut: Date; totalHours: number }[] = [];
    for (const record of openRecords) {
      record.clockOut = autoTime;
      record.totalHours = parseFloat(
        ((autoTime.getTime() - record.clockIn!.getTime()) / 3600000).toFixed(2)
      );
      if (record.totalHours < 4) {
        record.status = "absent";
      } else if (record.totalHours < 5) {
        record.status = "half-day";
      }
      record.notes = (record.notes ? record.notes + " | " : "") + `Auto clock-out at ${autoTimeLabel}`;
      await record.save();
      closed.push({
        userId: record.userId.toString(),
        clockIn: record.clockIn!,
        clockOut: record.clockOut!,
        totalHours: record.totalHours!,
      });
      count++;
    }

    if (count > 0) {
      console.log(`[auto-clockout] Clocked out ${count} employee(s) at ${autoTime.toISOString()}`);

      // Notify each affected employee and the admin list. Fire-and-forget so a
      // slow or failing mail server never blocks (or fails) the cron run.
      const closedUsers = await User.find({ _id: { $in: closed.map((c) => c.userId) } })
        .select("name email")
        .lean();
      const userMap = new Map(closedUsers.map((u) => [u._id.toString(), u]));
      for (const c of closed) {
        const u = userMap.get(c.userId);
        if (!u?.email) continue;
        EmailService.sendAutoClockOutNotification(u.name, u.email, c.clockIn, c.clockOut, c.totalHours)
          .catch((err) => console.error("[auto-clockout] email failed:", (err as Error).message));
      }
    }
    return count;
  }

  /**
   * Returns the UTC-midnight Date for "yesterday" relative to the business calendar.
   */
  static getYesterday(): Date {
    const today = this.getToday();
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return yesterday;
  }

  /**
   * Auto-mark absent: for every active non-admin user with no attendance record
   * on `targetDate`, create a record with status "absent" (or "on-leave" if an
   * approved leave covers that date). Skips non-working-days (per CompanySettings)
   * and holidays. Called by the daily cron job once the work day has fully ended.
   */
  static async markAbsentForDate(targetDate: Date) {
    // Skip non-working days based on the configured working week
    const settings = await CompanySettings.findOne().select("workingDays").lean();
    const workingDays = (settings as any)?.workingDays as string[] | undefined;
    if (!isWorkingDow(targetDate.getUTCDay(), workingDays)) {
      return { skipped: "non-working-day", created: 0 };
    }

    // Skip holidays
    const isHoliday = await Holiday.exists({ date: targetDate });
    if (isHoliday) {
      return { skipped: "holiday", created: 0 };
    }

    // Active non-admin users
    const users = await User.find({
      isActive: true,
      role: { $ne: "admin" },
    })
      .select("_id")
      .lean();
    if (!users.length) return { skipped: null, created: 0 };

    const userIds = users.map((u) => u._id);

    // Users who already have a record for that date
    const existing = await Attendance.find({
      date: targetDate,
      userId: { $in: userIds },
    })
      .select("userId")
      .lean();
    const recordedIds = new Set(existing.map((r) => r.userId.toString()));

    // Users with an approved leave covering that date
    const approvedLeaves = await Leave.find({
      status: "approved",
      startDate: { $lte: targetDate },
      endDate: { $gte: targetDate },
      userId: { $in: userIds },
    })
      .select("userId")
      .lean();
    const onLeaveIds = new Set(approvedLeaves.map((l) => l.userId.toString()));

    const docs: Partial<IAttendance>[] = [];
    for (const u of userIds) {
      const id = u.toString();
      if (recordedIds.has(id)) continue;
      docs.push({
        userId: u,
        date: targetDate,
        clockIn: null,
        clockOut: null,
        totalHours: null,
        status: onLeaveIds.has(id) ? "on-leave" : "absent",
        notes: onLeaveIds.has(id) ? "Auto-marked: approved leave" : "Auto-marked: no clock-in",
      });
    }

    if (!docs.length) return { skipped: null, created: 0 };

    try {
      await Attendance.insertMany(docs, { ordered: false });
    } catch (err: any) {
      // Ignore duplicate-key errors (race with manual clock-in); rethrow others
      if (err?.code !== 11000 && !(err?.writeErrors && err.writeErrors.every((e: any) => e.code === 11000))) {
        throw err;
      }
    }

    console.log(`[mark-absent] ${docs.length} record(s) created for ${targetDate.toISOString().slice(0, 10)}`);
    return { skipped: null, created: docs.length };
  }

  /**
   * Backfill absent records across a date range (inclusive on both ends).
   * Iterates day by day calling markAbsentForDate. Stops at today (never future).
   */
  static async markAbsentForRange(from: Date, to: Date) {
    const today = this.getToday();
    if (from > to) throw new ApiError(400, "'from' must be on or before 'to'.");

    const results: { date: string; created: number; skipped: string | null }[] = [];
    const cursor = new Date(from);
    while (cursor <= to && cursor <= today) {
      const r = await this.markAbsentForDate(new Date(cursor));
      results.push({
        date: cursor.toISOString().slice(0, 10),
        created: r.created,
        skipped: r.skipped,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const totalCreated = results.reduce((s, d) => s + d.created, 0);
    return { totalCreated, days: results };
  }

  // ── Per-user auto clock-out preference ──
  static async getPreferences(userId: string) {
    const user = await User.findById(userId).select("autoClockOutEnabled").lean();
    return { autoClockOutEnabled: user?.autoClockOutEnabled !== false };
  }

  static async updatePreferences(userId: string, autoClockOutEnabled: boolean) {
    await User.findByIdAndUpdate(userId, { autoClockOutEnabled });
    return { autoClockOutEnabled };
  }

  // Generic range report. `startDate` and `endDate` are inclusive, local-time day boundaries.
  // Admin users are excluded — reports are about the workforce, not system operators.
  static async getReportForRange(startDate: Date, endDate: Date, userId?: string) {
    const filter: Record<string, unknown> = {
      date: { $gte: startDate, $lte: endDate },
    };
    if (userId) {
      filter.userId = userId;
    } else {
      const adminIds = (await User.find({ role: "admin" }).select("_id").lean()).map((u) => u._id);
      if (adminIds.length) filter.userId = { $nin: adminIds };
    }

    const rawRecords = await Attendance.find(filter)
      .populate("userId", "name email department userId")
      .sort("date")
      .lean();

    // Drop orphan records whose user reference no longer resolves (e.g. user deleted).
    // Without this, .populate() returns userId: null and the loop below would throw
    // when reading user.name / user._id, producing a 500 for the whole report.
    const records = rawRecords.filter((r) => r.userId != null);

    const grouped: Record<
      string,
      {
        _id: unknown;
        name: string;
        email: string;
        department: string;
        userId: string | null;
        records: typeof records;
        totalHours: number;
        presentDays: number;
        lateDays: number;
        absentDays: number;
        halfDays: number;
        onLeaveDays: number;
        // Track which date keys we've already counted as on-leave from attendance
        // records, so the Leave overlay below doesn't double-count.
        leaveDateKeys: Set<string>;
      }
    > = {};

    const dateKey = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

    for (const r of records) {
      const user = r.userId as any;
      const uid = user?._id?.toString();
      if (!uid) continue;
      if (!grouped[uid]) {
        grouped[uid] = {
          _id: user._id,
          name: user.name || "Unknown",
          email: user.email || "",
          department: user.department || "",
          userId: user.userId || null,
          records: [],
          totalHours: 0,
          presentDays: 0,
          lateDays: 0,
          absentDays: 0,
          halfDays: 0,
          onLeaveDays: 0,
          leaveDateKeys: new Set(),
        };
      }
      grouped[uid].records.push(r);
      grouped[uid].totalHours += r.totalHours || 0;
      if (r.status === "present") grouped[uid].presentDays++;
      else if (r.status === "late") grouped[uid].lateDays++;
      else if (r.status === "absent") grouped[uid].absentDays++;
      else if (r.status === "half-day") grouped[uid].halfDays++;
      else if (r.status === "on-leave") {
        grouped[uid].onLeaveDays++;
        grouped[uid].leaveDateKeys.add(dateKey(new Date(r.date)));
      }
    }

    // Overlay approved leaves on top — covers days where the auto-mark cron
    // hasn't yet stamped an on-leave row (early in the day, leaves approved
    // after the cron ran for that date, etc.). Skip dates already counted via
    // attendance records.
    const userFilter: Record<string, unknown> = {};
    if (userId) userFilter.userId = userId;
    const approvedLeaves = await Leave.find({
      status: "approved",
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
      ...userFilter,
    }).select("userId startDate endDate").lean();

    for (const lv of approvedLeaves) {
      const uid = lv.userId.toString();
      if (!grouped[uid]) continue; // user not in the report range
      const lStart = new Date(lv.startDate);
      const lEnd = new Date(lv.endDate);
      // Walk each calendar day in the leave range that overlaps [startDate, endDate]
      const dayStart = new Date(Math.max(lStart.getTime(), startDate.getTime()));
      const dayEnd = new Date(Math.min(lEnd.getTime(), endDate.getTime()));
      // Normalize to UTC midnight to step day-by-day deterministically.
      let cur = new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), dayStart.getUTCDate()));
      const stop = new Date(Date.UTC(dayEnd.getUTCFullYear(), dayEnd.getUTCMonth(), dayEnd.getUTCDate()));
      while (cur.getTime() <= stop.getTime()) {
        const key = dateKey(cur);
        if (!grouped[uid].leaveDateKeys.has(key)) {
          grouped[uid].onLeaveDays++;
          grouped[uid].leaveDateKeys.add(key);
        }
        cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    // Strip the internal Set before returning — it's not serialisable.
    const employees = Object.values(grouped).map(({ leaveDateKeys: _drop, ...rest }) => rest);

    // Attach signed profile photo URLs in a single batched lookup so the UI can
    // render real avatars instead of initials fallbacks.
    const withPhotos = (await attachProfilePhotoUrls(employees)) as Array<
      (typeof employees)[number] & { profilePhotoUrl?: string }
    >;

    return {
      startDate,
      endDate,
      employees: withPhotos,
      allRecords: records,
    };
  }

  static async getMonthlyReport(month: string, userId?: string) {
    const [year, m] = month.split("-").map(Number);
    const startDate = new Date(year, m - 1, 1);
    const endDate = new Date(year, m, 0); // last day of month
    const base = await AttendanceService.getReportForRange(startDate, endDate, userId);
    return { month: `${year}-${String(m).padStart(2, "0")}`, ...base };
  }
}
