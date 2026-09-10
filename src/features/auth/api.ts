import { Api } from "@/shared/api/client";
import type { Role, User, UserDto } from "@/shared/types/domain";

/**
 * Auth API module.
 *
 * Backend routes (NestJS, global prefix `api/` applied by the axios base URL):
 *  - POST /auth/register  { email, password, name, phone?, acceptTerms: true,
 *                           termsVersion }                  -> AuthResult
 *      409 TERMS_OUTDATED when `termsVersion` differs from the server's current one
 *  - POST /auth/login     { email, password }               -> AuthResult
 *      401 USER_SUSPENDED for a suspended account
 *  - POST /auth/logout    (cookie session)                   -> 204 + clears cookies
 *  - POST /auth/forgot-password { email }                    -> 202 {} (always)
 *  - POST /auth/reset-password  { token, password, acceptTerms: true,
 *                                 termsVersion }             -> 204
 *      400 RESET_TOKEN_INVALID (unknown / expired / used), 409 TERMS_OUTDATED
 *  - PATCH /auth/change-password { currentPassword, newPassword } -> 204
 *      401 on a wrong current password (session preserved)
 *  - GET  /users/me       (cookie session)                   -> UserDto
 *  - PATCH /users/me      (cookie session) { name?, phone? } -> UserDto
 *      (safe profile fields only; email/roles/password have guarded flows)
 *  - DELETE /users/me     { password }                        -> 204
 *      401 PASSWORD_INCORRECT, 409 ACCOUNT_HAS_ACTIVE_BOOKINGS,
 *      409 ACCOUNT_OWNS_AGENCY
 *
 * SESSION: login/register/refresh responses still carry `accessToken`/
 * `refreshToken` in the body for the Expo app, but the web IGNORES them:
 * the same responses set the httpOnly cookies (`cibaura_access` /
 * `cibaura_refresh`) that authenticate every later request. Only the `user`
 * snapshot leaves this module.
 *
 * The backend user carries a single `name`; this module maps it to the web's
 * `fullName` at the boundary so components keep their existing shape. The wire
 * carries `name` in both directions; the type fork stays local to the client.
 */

export const authKeys = {
  all: ["auth"] as const,
  me: () => ["auth", "me"] as const,
};

/** Form-facing input; `fullName` is sent to the backend as `name`. */
export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  /** The version read from `GET /legal/current`, never a literal. */
  termsVersion: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ResetPasswordInput {
  /** 64-hex token from the reset link (`?token=`). */
  token: string;
  password: string;
  termsVersion: string;
}

/** PATCH /auth/change-password body (any authenticated user). */
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/**
 * Raw backend user. `/users/me` returns the full `UserDto`; the auth
 * responses embed the same shape (some fields may be absent on older rows).
 */
type BackendUser = Pick<UserDto, "id" | "email" | "name"> &
  Partial<Omit<UserDto, "id" | "email" | "name" | "roles">> & {
    roles: Role[];
  };

/**
 * Wire shape of login/register. The token fields exist for the Expo app;
 * the web deliberately never reads them (cookies carry the session).
 */
interface BackendAuthResult {
  accessToken: string;
  refreshToken: string;
  user: BackendUser;
}

export interface AuthResponse {
  user: User;
}

/** Map the backend user (`name`) onto the web `User` (`fullName`). */
function toUser(u: BackendUser): User {
  return {
    id: u.id,
    email: u.email,
    phone: u.phone ?? undefined,
    fullName: u.name,
    roles: u.roles,
    agencyId: u.agencyId ?? undefined,
    status: u.status,
    termsVersion: u.termsVersion ?? null,
    createdAt: u.createdAt ?? "",
  };
}

export const AuthApi = {
  async register(input: RegisterInput): Promise<AuthResponse> {
    const res = await Api.post<BackendAuthResult>("/auth/register", {
      email: input.email,
      password: input.password,
      name: input.fullName,
      phone: input.phone,
      acceptTerms: true,
      termsVersion: input.termsVersion,
    });
    // Session = httpOnly cookies set by this response; body tokens ignored.
    return { user: toUser(res.data.user) };
  },

  async login(input: LoginInput): Promise<AuthResponse> {
    const res = await Api.post<BackendAuthResult>("/auth/login", input);
    // Session = httpOnly cookies set by this response; body tokens ignored.
    return { user: toUser(res.data.user) };
  },

  async logout(): Promise<void> {
    await Api.post("/auth/logout", {});
  },

  /**
   * Always resolves (202): the backend never reveals whether the email
   * exists. The UI shows the same "check your inbox" message either way.
   */
  async forgotPassword(email: string): Promise<void> {
    await Api.post("/auth/forgot-password", { email });
  },

  /** 204 on success; the server revokes every session of the user. */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    await Api.post("/auth/reset-password", {
      token: input.token,
      password: input.password,
      acceptTerms: true,
      termsVersion: input.termsVersion,
    });
  },

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
  },

  async me(): Promise<User> {
    // `/users/me` returns the serialized `UserDto` (name/phone/status/
    // termsVersion/createdAt); mapped to the web `User` shape.
    const res = await Api.get<BackendUser>("/users/me");
    return toUser(res.data);
  },

  /**
   * Update the caller's own profile, the SAFE fields only (name/phone; the
   * backend rejects anything else). `phone: null` clears it. Returns the
   * updated user, already mapped to the web shape.
   */
  async updateMe(input: {
    fullName: string;
    phone?: string | null;
  }): Promise<User> {
    const res = await Api.patch<BackendUser>("/users/me", {
      name: input.fullName,
      phone: input.phone ?? null,
    });
    return toUser(res.data);
  },

  /**
   * Delete the caller's account (204). Password re-confirmation travels in
   * the body. The backend anonymizes the row, purges KYC documents, detaches
   * saved cards and revokes every session; bookings/payments stay for the
   * legal retention period.
   */
  async deleteAccount(password: string): Promise<void> {
    await Api.delete("/users/me", { data: { password } });
  },
};
