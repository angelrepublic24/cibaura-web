import { Api } from "@/shared/api/client";
import type {
  PlatformConfig,
  PlatformConfigPatch,
} from "./platform-config-contract";

const UNSUPPORTED =
  "The server returned an unsupported configuration. Settings cannot be edited safely.";

const UNCONFIRMED =
  "The server did not confirm the requested values. Changes may have been applied; reload the configuration to verify before retrying.";

export const platformConfigApi = {
  async getConfig(): Promise<PlatformConfig> {
    const { platformConfigSchema } = await import("./platform-config-contract");
    const response = await Api.get<unknown>("/admin/config");
    const result = platformConfigSchema.safeParse(response.data);
    if (!result.success) throw new Error(UNSUPPORTED);
    return result.data;
  },

  /**
   * `PATCH /admin/config` — ONE write for all fifteen settings.
   *
   * The body is the DIFF the form computed, never the whole object: an absent
   * field keeps its stored value, so a setting the console cannot currently
   * express (a commission booted from env with three decimals, a value a psql
   * session put out of range) does not block saving the others.
   *
   * The response is the COMPLETE config, which is what the caller should put
   * in its state — the server is the one that decides what got stored. Every
   * field we asked for is compared against what came back, because a backend
   * that silently clamped or ignored a value would otherwise leave the console
   * showing numbers that are not in the database.
   */
  async updateConfig(patch: PlatformConfigPatch): Promise<PlatformConfig> {
    const { platformConfigPatchSchema, platformConfigSchema } = await import(
      "./platform-config-contract"
    );
    const body = platformConfigPatchSchema.parse(patch);
    const response = await Api.patch<unknown>("/admin/config", body);
    const result = platformConfigSchema.safeParse(response.data);
    if (!result.success) throw new Error(UNSUPPORTED);
    const applied = result.data;
    const rejected = Object.entries(body).filter(
      ([field, value]) => applied[field as keyof PlatformConfig] !== value,
    );
    if (rejected.length > 0) throw new Error(UNCONFIRMED);
    return applied;
  },
};
