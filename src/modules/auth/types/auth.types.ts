import type { z } from "zod";
import type { User } from "@/shared/types/domain";
import type {
  authUserWireSchema,
  changePasswordInputSchema,
  changePasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  registerInputSchema,
  registerSchema,
  resetPasswordInputSchema,
  resetPasswordSchema,
  updateMeInputSchema,
} from "@/modules/auth/schema/auth.schema";

/**
 * Auth types — every one is the `z.infer` of a schema in `../schema`, so the
 * schema is the single source of truth and the type can never drift from it.
 */

// --------------------------------------------------------------- form values

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
export type DeleteAccountFormValues = z.infer<typeof deleteAccountSchema>;

// ------------------------------------------------------------- wire contract

export type AuthUserWire = z.infer<typeof authUserWireSchema>;

// -------------------------------------------------------------- service input

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
export type UpdateMeInput = z.infer<typeof updateMeInputSchema>;

/**
 * What leaves the service for the client: only the mapped `User` snapshot.
 * The wire's token fields never cross this boundary on the web.
 */
export interface AuthResponse {
  user: User;
}
