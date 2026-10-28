import { z } from "zod";

/**
 * Auth schemas (zod v4). Two families live here:
 *  - FORM schemas, consumed by react-hook-form on the auth pages.
 *  - WIRE + INPUT schemas, the contract the `AuthService` validates every
 *    response against (`schema.parse(res.data)`) and types its arguments by.
 * The `z.infer` types derived from all of these live in `../types/auth.types`.
 */

// ------------------------------------------------------------------- helpers

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

// --------------------------------------------------------------- form schemas

export const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

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

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email"),
});

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

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm"),
});

// ------------------------------------------------------------- wire schemas

/** Backend `Role` enum (`docs/DOMAIN.md` — Actors & roles). */
export const roleSchema = z.enum([
  "customer",
  "agency_owner",
  "agency_staff",
  "platform_admin",
]);

/** Account lifecycle (`users.status`). */
export const userStatusSchema = z.enum(["active", "suspended", "deleted"]);

/**
 * Raw backend user. `/users/me` returns the full serialized user; the auth
 * responses embed the same shape. `name` (not `fullName`) crosses the wire in
 * both directions; `status`/`createdAt` may be absent on older rows, and
 * `phone`/`agencyId`/`termsVersion` are nullable.
 */
export const authUserWireSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  roles: z.array(roleSchema),
  phone: z.string().nullish(),
  agencyId: z.string().nullish(),
  status: userStatusSchema.optional(),
  termsVersion: z.string().nullish(),
  createdAt: z.string().optional(),
});

/**
 * Wire shape of login/register. The token fields exist for the Expo app; the
 * web deliberately never reads them (httpOnly cookies carry the session).
 */
export const authResultWireSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: authUserWireSchema,
});

// ------------------------------------------------------------ input schemas

/** `POST /auth/register` input; `fullName` is sent to the backend as `name`. */
export const registerInputSchema = z.object({
  email: z.string(),
  password: z.string(),
  fullName: z.string(),
  phone: z.string().optional(),
  /** The version read from `GET /legal/current`, never a literal. */
  termsVersion: z.string(),
});

/** `POST /auth/reset-password` input (64-hex token from the reset link). */
export const resetPasswordInputSchema = z.object({
  token: z.string(),
  password: z.string(),
  termsVersion: z.string(),
});

/** `PATCH /auth/change-password` input (any authenticated user). */
export const changePasswordInputSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

/** `PATCH /users/me` input — the SAFE profile fields only. */
export const updateMeInputSchema = z.object({
  fullName: z.string(),
  phone: z.string().nullish(),
});
