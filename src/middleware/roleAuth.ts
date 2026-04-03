import { Response, NextFunction } from "express";
import { AuthRequest, UserRole } from "../types";
import { ApiError } from "../utils/ApiError";

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required."));
    }

    if (!roles.includes(req.user.role as UserRole)) {
      return next(
        new ApiError(403, "You do not have permission to perform this action.")
      );
    }

    next();
  };
};
