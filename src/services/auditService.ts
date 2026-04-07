import AuditLog from "../models/AuditLog";

export type AuditModule =
  | "auth"
  | "attendance"
  | "timesheet"
  | "leave"
  | "documents"
  | "employees"
  | "approvals"
  | "settings"
  | "roles"
  | "reports"
  | "projects"
  | "announcements"
  | "chat";

interface LogParams {
  userId: string;
  action: string;
  module: AuditModule;
  details?: string;
  ipAddress?: string;
}

/**
 * Centralized audit logger.
 * Fire-and-forget — never throws so it can't break the calling operation.
 */
export class AuditService {
  static async log(params: LogParams): Promise<void> {
    try {
      await AuditLog.create({
        userId: params.userId,
        action: params.action,
        module: params.module,
        details: params.details,
        ipAddress: params.ipAddress,
      });
    } catch (e) {
      console.error("[audit] failed to log:", (e as Error).message);
    }
  }
}
