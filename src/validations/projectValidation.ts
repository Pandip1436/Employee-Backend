import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters"),
  description: z.string().optional(),
  client: z.string().min(1, "Client name is required"),
  status: z.enum(["active", "completed", "on-hold"]).optional(),
  assignedUsers: z.array(z.string()).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  client: z.string().optional(),
  status: z.enum(["active", "completed", "on-hold"]).optional(),
  assignedUsers: z.array(z.string()).optional(),
});
