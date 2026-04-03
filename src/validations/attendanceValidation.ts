import { z } from "zod";

export const clockInSchema = z.object({
  notes: z.string().optional(),
});

export const clockOutSchema = z.object({
  notes: z.string().optional(),
});
