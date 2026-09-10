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

/** Backend password rule (`RegisterDto` / `ResetPasswordDto`: 8..72 chars). */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

/**
 * Terms acceptance — the server rejects anything but `true`
 * (`@Equals(true) acceptTerms`). Modelled as a boolean refined to `true` so
 * the form can start unchecked and still type-check its default values.
 */
export const acceptTermsSchema = z.boolean().refine((v) => v === true, {
  message: "You must accept the Terms of Service and Privacy Policy",
});

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
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: acceptTermsSchema,
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email"),
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: acceptTermsSchema,
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "New password must be different from the current one",
    path: ["newPassword"],
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm"),
});
export type DeleteAccountFormValues = z.infer<typeof deleteAccountSchema>;
