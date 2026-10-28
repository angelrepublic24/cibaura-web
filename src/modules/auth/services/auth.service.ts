import { Api } from "@/shared/api/client";
import type { User } from "@/shared/types/domain";
import {
  authResultWireSchema,
  authUserWireSchema,
} from "@/modules/auth/schema/auth.schema";
import type {
  AuthResponse,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateMeInput,
} from "@/modules/auth/types/auth.types";
import { toUser } from "@/modules/auth/helpers/auth.helper";

/**
 * Auth API client — the ONLY thing in the module that talks to the backend.
 * Every method is a single call that validates the response against its zod
 * schema (`schema.parse(res.data)`) and returns a typed result; hooks call
 * these, components call hooks.
 *
 * Backend routes (NestJS, global `api/` prefix applied by the axios base URL):
 *  - POST  /auth/register { email, password, name, phone?, acceptTerms: true,
 *                           termsVersion }                 -> AuthResult
 *      409 TERMS_OUTDATED when `termsVersion` differs from the server's one
 *  - POST  /auth/login    { email, password }              -> AuthResult
 *      401 USER_SUSPENDED for a suspended account
 *  - POST  /auth/logout   (cookie session)                 -> 204 + clears cookies
 *  - POST  /auth/forgot-password { email }                 -> 202 {} (always)
 *  - POST  /auth/reset-password  { token, password, acceptTerms: true,
 *                                  termsVersion }           -> 204
 *      400 RESET_TOKEN_INVALID (unknown / expired / used), 409 TERMS_OUTDATED
 *  - PATCH /auth/change-password { currentPassword, newPassword } -> 204
 *      401 on a wrong current password (session preserved)
 *  - GET   /users/me      (cookie session)                 -> UserDto
 *  - PATCH /users/me      (cookie session) { name?, phone? } -> UserDto
 *  - DELETE /users/me     { password }                      -> 204
 *      401 PASSWORD_INCORRECT, 409 ACCOUNT_HAS_ACTIVE_BOOKINGS,
 *      409 ACCOUNT_OWNS_AGENCY
 *
 * SESSION: login/register/refresh responses still carry `accessToken`/
 * `refreshToken` in the body for the Expo app, but the web IGNORES them: the
 * same responses set the httpOnly cookies (`cibaura_access` /
 * `cibaura_refresh`) that authenticate every later request. Only the mapped
 * `user` snapshot leaves this module.
 */
class AuthService {
  async register(input: RegisterInput): Promise<AuthResponse> {
    const res = await Api.post<unknown>("/auth/register", {
      email: input.email,
      password: input.password,
      name: input.fullName,
      phone: input.phone,
      acceptTerms: true,
      termsVersion: input.termsVersion,
    });
    // Session = httpOnly cookies set by this response; body tokens ignored.
    const { user } = authResultWireSchema.parse(res.data);
    return { user: toUser(user) };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const res = await Api.post<unknown>("/auth/login", input);
    // Session = httpOnly cookies set by this response; body tokens ignored.
    const { user } = authResultWireSchema.parse(res.data);
    return { user: toUser(user) };
  }

  async logout(): Promise<void> {
    await Api.post("/auth/logout", {});
  }

  /**
   * Always resolves (202): the backend never reveals whether the email
   * exists. The UI shows the same "check your inbox" message either way.
   */
  async forgotPassword(email: string): Promise<void> {
    await Api.post("/auth/forgot-password", { email });
  }

  /** 204 on success; the server revokes every session of the user. */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    await Api.post("/auth/reset-password", {
      token: input.token,
      password: input.password,
      acceptTerms: true,
      termsVersion: input.termsVersion,
    });
  }

  /**
   * Change the current user's password (204 No Content on success).
   *
   * A wrong current password returns 401 while the session itself is still
   * valid. The shared axios interceptor knows this: `/auth/change-password`
   * is on its no-refresh list, so that 401 just surfaces as an error here,
   * with no refresh attempt and no forced sign-out. Other sessions are
   * revoked server-side; the current cookie pair stays valid.
   */
  async changePassword(input: ChangePasswordInput): Promise<void> {
    await Api.patch("/auth/change-password", input);
  }

  async me(): Promise<User> {
    // `/users/me` returns the serialized user (name/phone/status/
    // termsVersion/createdAt); mapped to the web `User` shape.
    const res = await Api.get<unknown>("/users/me");
    return toUser(authUserWireSchema.parse(res.data));
  }

  /**
   * Update the caller's own profile, the SAFE fields only (name/phone; the
   * backend rejects anything else). `phone: null` clears it. Returns the
   * updated user, already mapped to the web shape.
   */
  async updateMe(input: UpdateMeInput): Promise<User> {
    const res = await Api.patch<unknown>("/users/me", {
      name: input.fullName,
      phone: input.phone ?? null,
    });
    return toUser(authUserWireSchema.parse(res.data));
  }

  /**
   * Delete the caller's account (204). Password re-confirmation travels in
   * the body. The backend anonymizes the row, purges KYC documents, detaches
   * saved cards and revokes every session; bookings/payments stay for the
   * legal retention period.
   */
  async deleteAccount(password: string): Promise<void> {
    await Api.delete("/users/me", { data: { password } });
  }
}

export const authService = new AuthService();
