import mongoose from "mongoose";
import User from "../models/User";
import InternProfile from "../models/InternProfile";
import EmployeeProfile from "../models/EmployeeProfile";
import { IInternProfile, InternshipType, InternStatus, IUser, PaginatedResult } from "../types";
import { ApiError } from "../utils/ApiError";
import { parsePagination } from "../utils/helpers";
import { attachProfilePhotoUrls } from "./userService";
import { EmployeeProfileService } from "./employeeProfileService";

// The internship fields an admin may write. Anything else on the request body
// belongs to the User account and is handled separately.
const INTERNSHIP_KEYS = [
  "college", "degree", "courseYear", "mentorId", "startDate", "endDate",
  "durationMonths", "stipend", "internshipType", "status", "conversionDate",
  "certificateIssued", "notes",
] as const;

// Shapes below mirror the zod schemas in validations/internValidation.ts, which
// have already run by the time the service is reached.
export interface InternshipPatch {
  college?: string;
  degree?: string;
  courseYear?: string;
  mentorId?: string | null;
  startDate?: string;
  endDate?: string;
  durationMonths?: number;
  stipend?: number;
  internshipType?: InternshipType;
  status?: InternStatus;
  conversionDate?: string;
  certificateIssued?: boolean;
  notes?: string;
}

export interface ContactPatch {
  phone?: string;
  address?: string;
}

export interface CreateInternInput extends InternshipPatch, ContactPatch {
  name: string;
  email: string;
  userId: string;
  password: string;
  department?: string;
}

export interface UpdateInternInput extends InternshipPatch, ContactPatch {
  name?: string;
  email?: string;
  userId?: string;
  department?: string;
  isActive?: boolean;
  inactiveReason?: string;
  relievingDate?: string;
}

const pickInternshipFields = (data: InternshipPatch): InternshipPatch => {
  const src = data as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of INTERNSHIP_KEYS) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  // Empty strings from the form clear the mentor rather than failing ObjectId casting.
  if (out.mentorId === "") out.mentorId = null;
  return out as InternshipPatch;
};

const pickContactFields = (data: ContactPatch): ContactPatch => {
  const out: ContactPatch = {};
  if (data.phone !== undefined) out.phone = data.phone;
  if (data.address !== undefined) out.address = data.address;
  return out;
};

// A row in the interns directory: the User account, its InternProfile, and the
// contact details held on the shared EmployeeProfile record.
export interface InternRecord extends Record<string, unknown> {
  internProfile: IInternProfile | null;
  phone?: string;
  address?: string;
}

// Batched lookup of contact details for a set of users.
async function contactByUser(
  userIds: mongoose.Types.ObjectId[]
): Promise<Map<string, { phone?: string; address?: string }>> {
  if (!userIds.length) return new Map();
  const profiles = await EmployeeProfile.find({ userId: { $in: userIds } })
    .select("userId phone address")
    .lean();
  return new Map(
    profiles.map((p) => [p.userId.toString(), { phone: p.phone, address: p.address }])
  );
}

export class InternService {
  // List interns with their internship data attached. Filters mirror the
  // employees directory (search / active / department) plus internship status.
  static async getAll(query: {
    page?: number;
    limit?: number;
    sort?: string;
    isActive?: string;
    search?: string;
    department?: string;
    status?: string;
    mentorId?: string;
  }): Promise<PaginatedResult<InternRecord>> {
    const { page, limit, skip, sort } = parsePagination(query);

    const filter: Record<string, unknown> = { role: "intern" };
    if (query.isActive !== undefined) filter.isActive = query.isActive === "true";
    if (query.department) filter.department = String(query.department).trim();
    if (query.search) {
      const escaped = String(query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = { $regex: escaped, $options: "i" };
      filter.$or = [{ name: rx }, { email: rx }, { userId: rx }];
    }

    // Internship-level filters live on InternProfile, so narrow the user set first.
    if (query.status || query.mentorId) {
      const profileFilter: Record<string, unknown> = {};
      if (query.status) profileFilter.status = query.status;
      if (query.mentorId) profileFilter.mentorId = query.mentorId;
      const matching = await InternProfile.find(profileFilter).select("userId").lean();
      filter._id = { $in: matching.map((p) => p.userId) };
    }

    const [users, total] = await Promise.all([
      User.find(filter).sort(sort).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    const enriched = await attachProfilePhotoUrls(users);
    const userIds = users.map((u) => u._id);
    const [profiles, contacts] = await Promise.all([
      InternProfile.find({ userId: { $in: userIds } })
        .populate("mentorId", "name email userId")
        .lean(),
      contactByUser(userIds),
    ]);
    const byUser = new Map(profiles.map((p) => [p.userId.toString(), p]));

    const data = enriched.map((u) => ({
      ...u,
      internProfile: (byUser.get(String(u._id)) as unknown as IInternProfile) ?? null,
      ...(contacts.get(String(u._id)) ?? {}),
    })) as InternRecord[];

    return {
      data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  static async getById(id: string): Promise<InternRecord> {
    const user = await User.findOne({ _id: id, role: "intern" });
    if (!user) throw new ApiError(404, "Intern not found.");
    const [enriched] = await attachProfilePhotoUrls([user]);
    const [profile, contacts] = await Promise.all([
      InternProfile.findOne({ userId: user._id })
        .populate("mentorId", "name email userId")
        .lean(),
      contactByUser([user._id]),
    ]);
    return {
      ...enriched,
      internProfile: (profile as unknown as IInternProfile) ?? null,
      ...(contacts.get(String(user._id)) ?? {}),
    };
  }

  // Create the intern's login account and internship record together. If the
  // profile write fails the account is rolled back so no half-made intern is left.
  static async create(data: CreateInternInput): Promise<InternRecord> {
    const email = String(data.email || "").trim().toLowerCase();
    const userId = String(data.userId || "").trim().toLowerCase();
    if (!userId) throw new ApiError(400, "User ID is required.");

    const [existingEmail, existingUserId] = await Promise.all([
      User.findOne({ email }),
      User.findOne({ userId }),
    ]);
    if (existingEmail) throw new ApiError(409, "Email already registered.");
    if (existingUserId) throw new ApiError(409, "User ID is already taken.");

    await this.assertMentorExists(data.mentorId);

    const user = await User.create({
      name: data.name,
      email,
      userId,
      password: data.password,
      department: data.department,
      role: "intern",
    });

    try {
      const { mentorId, ...internship } = pickInternshipFields(data);
      await InternProfile.create({
        ...internship,
        // A null mentor is only meaningful when clearing on update; on create just omit it.
        ...(mentorId ? { mentorId } : {}),
        userId: user._id,
      });
      const contact = pickContactFields(data);
      if (Object.keys(contact).length) {
        await EmployeeProfileService.update(user._id.toString(), contact as Record<string, unknown>);
      }
    } catch (err) {
      await Promise.all([
        User.deleteOne({ _id: user._id }),
        InternProfile.deleteOne({ userId: user._id }),
        EmployeeProfile.deleteOne({ userId: user._id }),
      ]);
      throw err;
    }

    return this.getById(user._id.toString());
  }

  // Update the account fields and internship fields in one call. Guards the same
  // userId/email uniqueness rules the users module enforces.
  static async update(id: string, data: UpdateInternInput): Promise<InternRecord> {
    const user = await User.findOne({ _id: id, role: "intern" });
    if (!user) throw new ApiError(404, "Intern not found.");

    const userPatch: Record<string, unknown> = {};
    if (data.name !== undefined) userPatch.name = data.name;
    if (data.department !== undefined) userPatch.department = data.department;

    if (data.email !== undefined) {
      const email = String(data.email).trim().toLowerCase();
      const clash = await User.findOne({ email, _id: { $ne: id } });
      if (clash) throw new ApiError(409, "Email already registered.");
      userPatch.email = email;
    }
    if (data.userId !== undefined) {
      const normalized = String(data.userId).trim().toLowerCase();
      const clash = await User.findOne({ userId: normalized, _id: { $ne: id } });
      if (clash) throw new ApiError(409, "User ID is already taken.");
      userPatch.userId = normalized;
    }
    if (data.isActive !== undefined) {
      userPatch.isActive = data.isActive;
      // Reactivating clears the exit metadata, matching UserService.update.
      if (data.isActive === true) {
        userPatch.inactiveReason = "";
        userPatch.relievingDate = "";
      } else {
        if (data.inactiveReason !== undefined) userPatch.inactiveReason = data.inactiveReason;
        if (data.relievingDate !== undefined) userPatch.relievingDate = data.relievingDate;
      }
    }

    await this.assertMentorExists(data.mentorId);

    if (Object.keys(userPatch).length) {
      await User.updateOne({ _id: id }, userPatch, { runValidators: true });
    }

    const internshipPatch = pickInternshipFields(data);
    if (Object.keys(internshipPatch).length) {
      await InternProfile.findOneAndUpdate(
        { userId: id },
        { $set: internshipPatch },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }

    const contactPatch = pickContactFields(data);
    if (Object.keys(contactPatch).length) {
      await EmployeeProfileService.update(id, contactPatch as Record<string, unknown>);
    }

    return this.getById(id);
  }

  // Deleting an intern removes the login account, the internship record and the
  // contact/profile record created alongside it.
  static async delete(id: string): Promise<void> {
    const user = await User.findOne({ _id: id, role: "intern" });
    if (!user) throw new ApiError(404, "Intern not found.");
    await Promise.all([
      User.deleteOne({ _id: id }),
      InternProfile.deleteOne({ userId: id }),
      EmployeeProfile.deleteOne({ userId: id }),
    ]);
  }

  static async resetPassword(id: string, password: string): Promise<void> {
    const user = await User.findOne({ _id: id, role: "intern" }).select("+password");
    if (!user) throw new ApiError(404, "Intern not found.");
    user.password = password;
    // Force a fresh sign-in — the old session token no longer matches.
    user.activeToken = undefined;
    await user.save();
  }

  // Headline counts for the directory hero.
  static async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    completed: number;
    endingSoon: number;
  }> {
    const interns = await User.find({ role: "intern" }).select("_id isActive").lean();
    const ids = interns.map((u) => u._id);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const [completed, endingSoon] = await Promise.all([
      InternProfile.countDocuments({ userId: { $in: ids }, status: "completed" }),
      InternProfile.countDocuments({
        userId: { $in: ids },
        status: "active",
        endDate: { $gte: todayStr, $lte: in30 },
      }),
    ]);

    return {
      total: interns.length,
      active: interns.filter((u) => u.isActive).length,
      inactive: interns.filter((u) => !u.isActive).length,
      completed,
      endingSoon,
    };
  }

  // Mentors are the staff an intern can report to — never another intern.
  static async getMentorOptions(): Promise<IUser[]> {
    return User.find({ role: { $in: ["admin", "manager", "employee"] }, isActive: true })
      .select("name email userId role department")
      .sort("name") as unknown as IUser[];
  }

  private static async assertMentorExists(mentorId: unknown): Promise<void> {
    if (!mentorId || mentorId === "") return;
    if (!mongoose.isValidObjectId(mentorId as string)) {
      throw new ApiError(400, "Invalid mentor.");
    }
    const mentor = await User.findById(mentorId as string).select("_id role");
    if (!mentor) throw new ApiError(404, "Mentor not found.");
    if (mentor.role === "intern") {
      throw new ApiError(400, "An intern cannot be assigned as a mentor.");
    }
  }
}
