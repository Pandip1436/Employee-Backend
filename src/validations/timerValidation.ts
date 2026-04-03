import { z } from "zod";

export const startTimerSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  description: z.string().min(1, "Description is required"),
});
