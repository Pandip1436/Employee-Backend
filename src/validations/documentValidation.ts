import { z } from "zod";

export const uploadDocumentSchema = z.object({
  name: z.string().min(1, "Document name is required"),
  category: z.enum(["hr-docs", "policies", "employee-files", "templates", "other"]).optional(),
  access: z.enum(["all", "admin", "hr"]).optional(),
});
