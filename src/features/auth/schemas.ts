import { z } from "zod";

/** Form schemas (zod v4) shared by the auth pages. */

/**
 * Mirrors the backend phone rule (`RegisterDto` / `UpdateMeDto`:
 * `/^\+?[0-9\s-]{7,20}$/`) so a bad format fails client-side first instead
 * of round-tripping for the server's 400.
 */
export const PHONE_REGEX = /^\+?[0-9\s-]{7,20}$/;
export const PHONE_MESSAGE =
  "Enter a valid phone number (7–20 digits, spaces or dashes, optional +)";

export const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().min(2, "Enter your full name"),
    email: z.email("Enter a valid email"),
    phone: z
      .string()
      .regex(PHONE_REGEX, PHONE_MESSAGE)
      .optional()
      .or(z.literal("")),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type RegisterFormValues = z.infer<typeof registerSchema>;
