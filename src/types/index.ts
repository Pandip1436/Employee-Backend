import { Request } from "express";
import { Document, Types } from "mongoose";

// ── User ──
export type UserRole = "admin" | "manager" | "employee" | "intern";
export type UserStatus = "online" | "away" | "dnd";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  userId?: string;
  password: string;
  role: UserRole;
  department?: string;
  isActive: boolean;
  inactiveReason?: "resigned" | "terminated" | "retired" | "on-long-leave" | "contract-ended" | "other" | "";
  relievingDate?: string;
  autoClockOutEnabled?: boolean;
  userStatus?: UserStatus;
  activeToken?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// ── Intern ──
export type InternStatus = "active" | "completed" | "terminated" | "converted";
export type InternshipType = "full-time" | "part-time";

export interface IInternProfile extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  college?: string;
  degree?: string;
  courseYear?: string;
  mentorId?: Types.ObjectId;
  startDate?: string;
  endDate?: string;
  durationMonths?: number;
  stipend?: number;
  internshipType?: InternshipType;
  status: InternStatus;
  conversionDate?: string;
  certificateIssued?: boolean;
  certificateNo?: string;
  certificateIssuedAt?: string;
  certificateSentAt?: Date;
  certificateSentTo?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
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
