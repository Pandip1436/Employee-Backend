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
