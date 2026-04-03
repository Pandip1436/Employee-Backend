import EmployeeProfile from "../models/EmployeeProfile";
import { ApiError } from "../utils/ApiError";

function maskNumber(val: string | undefined, showLast = 4): string {
  if (!val) return "";
  if (val.length <= showLast) return val;
  return "X".repeat(val.length - showLast) + val.slice(-showLast);
}

export class EmployeeProfileService {
  static async getByUserId(userId: string, includeSensitive = false) {
    let query = EmployeeProfile.findOne({ userId });
    if (includeSensitive) {
      query = query.select("+bankAccountNumber +aadhaarNumber +panNumber +passportNumber");
    }

    let profile = await query.lean();
    if (!profile) {
      // Auto-create an empty profile
      profile = (await EmployeeProfile.create({ userId })).toObject();
    }

    // Mask sensitive fields for non-sensitive reads
    if (!includeSensitive) {
      return profile;
    }

    return {
      ...profile,
      bankAccountNumberMasked: maskNumber(profile.bankAccountNumber),
      aadhaarNumberMasked: maskNumber(profile.aadhaarNumber),
      panNumberMasked: maskNumber(profile.panNumber),
      passportNumberMasked: maskNumber(profile.passportNumber),
    };
  }

  static async update(userId: string, data: Record<string, unknown>) {
    const profile = await EmployeeProfile.findOneAndUpdate(
      { userId },
      { $set: data },
      { new: true, upsert: true, runValidators: true }
    ).select("+bankAccountNumber +aadhaarNumber +panNumber +passportNumber");

    if (!profile) throw new ApiError(404, "Profile not found.");
    return profile;
  }

  static async uploadProfilePhoto(userId: string, filePath: string) {
    return EmployeeProfile.findOneAndUpdate(
      { userId },
      { profilePhoto: filePath },
      { new: true, upsert: true }
    );
  }

  static async uploadOfferLetter(userId: string, filePath: string) {
    return EmployeeProfile.findOneAndUpdate(
      { userId },
      { offerLetterPath: filePath },
      { new: true, upsert: true }
    );
  }

  static async uploadCertificates(userId: string, filePaths: string[]) {
    return EmployeeProfile.findOneAndUpdate(
      { userId },
      { $push: { certificatePaths: { $each: filePaths } } },
      { new: true, upsert: true }
    );
  }
}
