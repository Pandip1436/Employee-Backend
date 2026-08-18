import { z } from "zod";
import { strongPassword } from "./passwordValidation";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

// Contact details live on the shared EmployeeProfile record, not InternProfile,
// so an intern's phone/address show up on their own profile page too.
const contactFields = {
  phone: z
    .string()
    .regex(/^\d{10}$/, "Phone must be 10 digits")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(500).optional(),
};

// Internship fields shared by create and update. Every field is optional here —
// createInternSchema pulls in the required account fields on top.
const internshipFields = {
  college: z.string().trim().max(120).optional(),
  degree: z.string().trim().max(120).optional(),
  courseYear: z.string().trim().max(40).optional(),
  mentorId: objectId.optional().or(z.literal("")),
  startDate: isoDate.optional().or(z.literal("")),
  endDate: isoDate.optional().or(z.literal("")),
  durationMonths: z.coerce.number().min(0).max(60).optional(),
  stipend: z.coerce.number().min(0).optional(),
  internshipType: z.enum(["full-time", "part-time"]).optional(),
  status: z.enum(["active", "completed", "terminated", "converted"]).optional(),
  conversionDate: isoDate.optional().or(z.literal("")),
  certificateIssued: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
};

// End date must not precede start date when both are supplied.
const endAfterStart = (v: { startDate?: string; endDate?: string }) =>
  !v.startDate || !v.endDate || v.endDate >= v.startDate;

export const createInternSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    userId: z
      .string()
      .min(3, "User ID must be at least 3 characters")
      .regex(/^[a-zA-Z0-9._-]+$/, "User ID can only contain letters, numbers, dot, dash, underscore"),
    password: strongPassword,
    department: z.string().optional(),
    ...internshipFields,
    ...contactFields,
  })
  .refine(endAfterStart, { message: "End date cannot be before start date", path: ["endDate"] });

// Emailing a certificate: both fields optional — the intern's own address and a
// plain congratulatory body are used when nothing is supplied.
export const sendCertificateSchema = z.object({
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional(),
});

export const updateInternSchema = z
  .object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    userId: z
      .string()
      .min(3, "User ID must be at least 3 characters")
      .regex(/^[a-zA-Z0-9._-]+$/, "User ID can only contain letters, numbers, dot, dash, underscore")
      .optional(),
    department: z.string().optional(),
    isActive: z.boolean().optional(),
    inactiveReason: z
      .enum(["resigned", "terminated", "retired", "on-long-leave", "contract-ended", "other", ""])
      .optional(),
    relievingDate: z.string().optional(),
    ...internshipFields,
    ...contactFields,
  })
  .refine(endAfterStart, { message: "End date cannot be before start date", path: ["endDate"] });
