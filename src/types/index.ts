import { Request } from "express";
import { Document, Types } from "mongoose";

// ── User ──
export type UserRole = "admin" | "manager" | "employee";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  userId?: string;
  password: string;
  role: UserRole;
  department?: string;
  isActive: boolean;
  autoClockOutEnabled?: boolean;
  activeToken?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// ── Project ──
export type ProjectStatus = "active" | "completed" | "on-hold";

export interface IProject extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  client: string;
  status: ProjectStatus;
  assignedUsers: Types.ObjectId[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ── Timesheet ──
export type TimesheetStatus = "draft" | "submitted" | "approved" | "rejected";

export interface ITimesheet extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  projectId: Types.ObjectId;
  date: Date;
  hours: number;
  description: string;
  status: TimesheetStatus;
  approvedBy?: Types.ObjectId;
  rejectionComment?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Timer ──
export interface ITimer extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  projectId: Types.ObjectId;
  description: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  isRunning: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Request ──
export interface AuthRequest extends Request {
  user?: IUser;
}

// ── Pagination ──
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// ── API Response ──
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}
