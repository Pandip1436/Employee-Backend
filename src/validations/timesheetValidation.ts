import { z } from "zod";

export const createTimesheetSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  date: z.string().min(1, "Date is required"),
  hours: z.number().min(0.25, "Minimum 0.25 hours").max(24, "Maximum 24 hours"),
  description: z.string().min(1, "Description is required"),
});

export const updateTimesheetSchema = z.object({
  projectId: z.string().optional(),
  date: z.string().optional(),
  hours: z.number().min(0.25).max(24).optional(),
  description: z.string().optional(),
});

export const approvalSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  rejectionComment: z.string().optional(),
});
