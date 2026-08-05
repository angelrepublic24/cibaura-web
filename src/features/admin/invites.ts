import { Api } from "@/shared/api/client";

/**
 * Platform-admin invites API.
 *
 * Backend routes (the global `api/` prefix is baked into the axios base URL):
 *  - POST   /admin/invites          @Auth(PLATFORM_ADMIN)  { email } -> { id, email, expiresAt }
 *  - GET    /admin/invites          @Auth(PLATFORM_ADMIN)           -> AdminInvite[]  (pending, non-expired)
 *  - DELETE /admin/invites/:id      @Auth(PLATFORM_ADMIN)           -> 204
 *  - GET    /admin/invites/verify   PUBLIC ?token=<raw>             -> { email }  (404/410 if bad/expired/used)
 *  - POST   /admin/invites/accept   PUBLIC { token, password }      -> 204
 *
 * The RAW token only ever travels in the emailed link's query and the accept
 * body; the server stores only its sha256 hash. This client never persists or
 * logs the raw token or the chosen password.
 */

/** Roles that can be granted via an admin invite (extend for future sub-roles). */
export const INVITE_ROLES = [
  { value: "platform_admin", label: "Platform admin (Root)" },
] as const;

export type InviteRole = (typeof INVITE_ROLES)[number]["value"];

export interface CreateInviteInput {
  firstName: string;
  lastName: string;
  email: string;
  role: InviteRole;
}

export interface AdminInvite {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  invitedByName?: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface CreatedInvite {
  id: string;
  email: string;
  expiresAt: string;
}

export interface VerifiedInvite {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export const inviteKeys = {
  all: ["admin", "invites"] as const,
  list: () => ["admin", "invites", "list"] as const,
  verify: (token: string) => ["admin", "invites", "verify", token] as const,
};

export const InvitesApi = {
  // ── Admin-gated management (platform_admin only) ─────────────────────────

  async create(input: CreateInviteInput): Promise<CreatedInvite> {
    const res = await Api.post("/admin/invites", input);
    return res.data;
  },

  async list(): Promise<AdminInvite[]> {
    const res = await Api.get("/admin/invites");
    return res.data;
  },

  async revoke(id: string): Promise<void> {
    await Api.delete(`/admin/invites/${id}`);
  },

  // ── Public, token-gated (the account-creation flow) ──────────────────────

  async verify(token: string): Promise<VerifiedInvite> {
    const res = await Api.get("/admin/invites/verify", { params: { token } });
    return res.data;
  },

  async accept(input: { token: string; password: string }): Promise<void> {
    await Api.post("/admin/invites/accept", input);
  },
};
