import { Api } from "@/shared/api/client";

/**
 * Platform-admin integrations API (encrypted third-party secrets).
 *
 * Backend routes (the global `api/` prefix is baked into the axios base URL,
 * all @Auth(PLATFORM_ADMIN)):
 *  - GET    /admin/integrations           -> IntegrationsView
 *  - PUT    /admin/integrations/:key      { value } -> SettingView (200)
 *  - DELETE /admin/integrations/:key                -> 204 (clears the DB
 *      override so the process.env fallback resumes)
 *
 * SECURITY: the server NEVER returns a plaintext secret. Secret settings only
 * ever expose a masked `preview` (last 4 chars). This client must therefore
 * never assume it can read back a value it just wrote — the PUT response is a
 * fresh masked SettingView, same as GET. Values typed here travel once in the
 * PUT body and are never persisted or logged client-side.
 */

/** Where a setting's resolved value currently comes from. */
export type SettingSource = "db" | "env" | "unset";

/** One integration setting as serialized by the backend (never plaintext). */
export interface SettingView {
  key: string;
  group: string;
  label: string;
  secret: boolean;
  source: SettingSource;
  /** A value exists from db OR env. */
  configured: boolean;
  /**
   * Secrets: masked, only last 4 chars visible (e.g. "••••4242").
   * Non-secrets: the full value. `null` when unset.
   */
  preview: string | null;
  /** An env fallback exists for this key. */
  envAvailable: boolean;
  /** ISO timestamp of when the DB override was last set, else null. */
  updatedAt: string | null;
}

/** One catalog group with its settings. */
export interface IntegrationsGroup {
  group: string;
  label: string;
  items: SettingView[];
}

/** GET /admin/integrations payload. */
export interface IntegrationsView {
  /**
   * process.env.CONFIG_ENCRYPTION_KEY present & valid on the server.
   * WRITES of secret keys require it; reads still work via env fallback.
   */
  masterKeyConfigured: boolean;
  groups: IntegrationsGroup[];
}

export const integrationKeys = {
  all: ["admin", "integrations"] as const,
  list: () => ["admin", "integrations", "list"] as const,
};

export const IntegrationsApi = {
  async list(): Promise<IntegrationsView> {
    const res = await Api.get("/admin/integrations");
    return res.data;
  },

  /** Set/replace a setting's DB override. Returns a fresh masked SettingView. */
  async set(key: string, value: string): Promise<SettingView> {
    const res = await Api.put(`/admin/integrations/${encodeURIComponent(key)}`, {
      value,
    });
    return res.data;
  },

  /** Clear the DB override so the env fallback resumes (204 No Content). */
  async clear(key: string): Promise<void> {
    await Api.delete(`/admin/integrations/${encodeURIComponent(key)}`);
  },
};
