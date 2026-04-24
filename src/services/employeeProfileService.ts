import EmployeeProfile from "../models/EmployeeProfile";
import { ApiError } from "../utils/ApiError";
import { StorageService } from "./storageService";

function maskNumber(val: string | undefined, showLast = 4): string {
  if (!val) return "";
  if (val.length <= showLast) return val;
  return "X".repeat(val.length - showLast) + val.slice(-showLast);
}

async function withFileUrls<T extends Record<string, any>>(profile: T): Promise<T & {
  profilePhotoUrl?: string;
  offerLetterUrl?: string;
  certificateUrls?: string[];
}> {
  const [profilePhotoUrl, offerLetterUrl, certificateUrls] = await Promise.all([
    profile.profilePhoto
      ? StorageService.getSignedDownloadUrl(profile.profilePhoto, 3600)
      : Promise.resolve(undefined),
    profile.offerLetterPath
      ? StorageService.getSignedDownloadUrl(profile.offerLetterPath, 3600)
      : Promise.resolve(undefined),
    Array.isArray(profile.certificatePaths) && profile.certificatePaths.length
      ? Promise.all(
          profile.certificatePaths.map((k: string) =>
            StorageService.getSignedDownloadUrl(k, 3600)
          )
        )
      : Promise.resolve(undefined),
  ]);

  return { ...profile, profilePhotoUrl, offerLetterUrl, certificateUrls };
}

export class EmployeeProfileService {
  static async getByUserId(userId: string, includeSensitive = false) {
    let query = EmployeeProfile.findOne({ userId });
    if (includeSensitive) {
      query = query.select("+bankAccountNumber +aadhaarNumber +panNumber +passportNumber");
    }

    let profile = await query.lean();
    if (!profile) {
      profile = (await EmployeeProfile.create({ userId })).toObject();
    }

    const enriched = await withFileUrls(profile);

    if (!includeSensitive) {
      return enriched;
    }

    return {
      ...enriched,
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

  static async uploadProfilePhoto(userId: string, key: string) {
    return EmployeeProfile.findOneAndUpdate(
      { userId },
      { profilePhoto: key },
      { new: true, upsert: true }
    );
  }

  static async uploadOfferLetter(userId: string, key: string) {
    return EmployeeProfile.findOneAndUpdate(
      { userId },
      { offerLetterPath: key },
      { new: true, upsert: true }
    );
  }

  static async uploadCertificates(userId: string, keys: string[]) {
    return EmployeeProfile.findOneAndUpdate(
      { userId },
      { $push: { certificatePaths: { $each: keys } } },
      { new: true, upsert: true }
    );
  }
}
