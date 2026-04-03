import { z } from "zod";

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "manager", "employee"]).optional(),
  department: z.string().optional(),
  isActive: z.boolean().optional(),
});
