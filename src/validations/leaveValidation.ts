import { z } from "zod";

export const applyLeaveSchema = z.object({
  type: z.enum(["casual", "sick", "earned", "unpaid"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().min(1, "Reason is required"),
});

export const leaveApprovalSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  rejectionComment: z.string().optional(),
});
