import { z } from "zod";
import { strongPassword } from "./passwordValidation";

export const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  userId: z
    .string()
    .min(3, "User ID must be at least 3 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "User ID can only contain letters, numbers, dot, dash, underscore"),
  password: strongPassword,
  role: z.enum(["admin", "manager", "employee"]).optional(),
  department: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  password: strongPassword,
});

export const bulkActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "At least one user ID is required"),
  action: z.enum(["activate", "deactivate", "delete"]),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  userId: z
    .string()
    .min(3, "User ID must be at least 3 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "User ID can only contain letters, numbers, dot, dash, underscore")
    .optional(),
  role: z.enum(["admin", "manager", "employee"]).optional(),
  department: z.string().optional(),
  isActive: z.boolean().optional(),
});
