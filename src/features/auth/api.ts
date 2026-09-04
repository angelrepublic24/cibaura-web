import { Api } from "@/shared/api/client";
import type { Role, User } from "@/shared/types/domain";

/**
 * Auth API module.
 *
 * Backend routes (NestJS, global prefix `api/` applied by the axios base URL):
 *  - POST /auth/register  { email, password, name, phone? } -> AuthResult
 *  - POST /auth/login     { email, password }               -> AuthResult
 *  - POST /auth/logout    (cookie session)                   -> 204 + clears cookies
 *  - GET  /auth/me        (cookie session)                   -> compact auth user
 *  - GET  /users/me       (cookie session)                   -> full User entity
 *  - PATCH /users/me      (cookie session) { name?, phone? } -> updated User
 *      (safe profile fields only — email/roles/password have guarded flows)
 *
 * SESSION: login/register/refresh responses still carry `accessToken`/
 * `refreshToken` in the body for the Expo app, but the web IGNORES them —
 * the same responses set the httpOnly cookies (`cibaura_access` /
 * `cibaura_refresh`) that authenticate every later request. Only the `user`
 * snapshot leaves this module.
 *
 * The backend user carries a single `name`; this module maps it to the web's
 * `fullName` at the boundary so components keep their existing shape. The wire
 * carries `name` in both directions — the type fork stays local to the client.
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
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Raw backend user (auth responses + `/users/me` share `name`, not `fullName`). */
interface BackendUser {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  roles: Role[];
  agencyId?: string | null;
  createdAt?: string;
}

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

  async me(): Promise<User> {
    // `/users/me` returns the full entity (name/phone/createdAt); mapped to the
    // web `User` shape. (`/auth/me` returns a leaner user without phone.)
    const res = await Api.get<BackendUser>("/users/me");
    return toUser(res.data);
  },

  /**
   * Update the caller's own profile — the SAFE fields only (name/phone; the
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
};
