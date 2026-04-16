import { z } from "zod";

// Strong password: min 8, at least 1 upper + lower + digit + symbol.
export const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((v) => /[A-Z]/.test(v), "Password must include an uppercase letter")
  .refine((v) => /[a-z]/.test(v), "Password must include a lowercase letter")
  .refine((v) => /\d/.test(v), "Password must include a digit")
  .refine((v) => /[^A-Za-z0-9]/.test(v), "Password must include a symbol");
