import { Api } from "@/shared/api/client";
import type { Role, User } from "@/shared/types/domain";

/**
 * Auth API module.
 *
 * Backend routes (NestJS, global prefix `api/` applied by the axios base URL):
 *  - POST /auth/register  { email, password, name, phone? } -> AuthResult
 *  - POST /auth/login     { email, password }               -> AuthResult
 *  - POST /auth/logout    (Bearer)                           -> 204
 *  - GET  /auth/me        (Bearer)                           -> compact auth user
 *  - GET  /users/me       (Bearer)                           -> full User entity
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

interface BackendAuthResult {
  accessToken: string;
  refreshToken: string;
  user: BackendUser;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
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
    return {
      user: toUser(res.data.user),
      accessToken: res.data.accessToken,
      refreshToken: res.data.refreshToken,
    };
  },

  async login(input: LoginInput): Promise<AuthResponse> {
    const res = await Api.post<BackendAuthResult>("/auth/login", input);
    return {
      user: toUser(res.data.user),
      accessToken: res.data.accessToken,
      refreshToken: res.data.refreshToken,
    };
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
};
