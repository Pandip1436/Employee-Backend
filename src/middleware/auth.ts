import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { AuthRequest } from "../types";
import { ApiError } from "../utils/ApiError";

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new ApiError(401, "Please sign in to continue.");
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
    };

    const user = await User.findById(decoded.id).select("+password +activeToken");
    if (!user || !user.isActive) {
      throw new ApiError(401, "We couldn't sign you in. This account may have been deactivated — please contact your admin.");
    }

    // Check if this token matches the active session
    if (user.activeToken && user.activeToken !== token) {
      throw new ApiError(401, "You've signed in from another device. This session has ended — please sign in again.");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError(401, "Your session has expired. Please sign in again."));
    }
  }
};
