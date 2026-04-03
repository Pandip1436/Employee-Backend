import jwt from "jsonwebtoken";
import User from "../models/User";
import { IUser } from "../types";
import { ApiError } from "../utils/ApiError";

export class AuthService {
  static generateToken(userId: string): string {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET as string, {
      expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"],
    } as jwt.SignOptions);
  }

  static async register(data: {
    name: string;
    email: string;
    password: string;
    role?: string;
    department?: string;
  }): Promise<{ user: IUser; token: string }> {
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new ApiError(409, "Email already registered.");
    }

    const user = await User.create(data);
    const token = this.generateToken(user._id.toString());

    return { user, token };
  }

  static async updateProfile(
    userId: string,
    data: { name?: string; email?: string; department?: string }
  ): Promise<IUser> {
    if (data.email) {
      const existing = await User.findOne({ email: data.email, _id: { $ne: userId } });
      if (existing) throw new ApiError(409, "Email already in use.");
    }
    const user = await User.findByIdAndUpdate(userId, data, { new: true, runValidators: true });
    if (!user) throw new ApiError(404, "User not found.");
    return user;
  }

  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await User.findById(userId).select("+password");
    if (!user) throw new ApiError(404, "User not found.");

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw new ApiError(401, "Current password is incorrect.");

    user.password = newPassword;
    await user.save();
  }

  static async login(
    email: string,
    password: string
  ): Promise<{ user: IUser; token: string }> {
    const user = await User.findOne({ email }).select("+password");
    if (!user || !user.isActive) {
      throw new ApiError(401, "Invalid email or password.");
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new ApiError(401, "Invalid email or password.");
    }

    const token = this.generateToken(user._id.toString());

    return { user, token };
  }
}
