import { Api } from "@/shared/api/client";
import type {
  CancellationPolicyDto,
  PlatformConfigDto,
} from "@/shared/types/domain";

const UNCONFIRMED =
  "The server did not confirm the requested values. Changes may have been applied; reload the configuration to verify before retrying.";

export const platformConfigApi = {
  async getConfig(): Promise<PlatformConfigDto> {
    const { platformConfigSchema } = await import("./platform-config-contract");
    const response = await Api.get<unknown>("/admin/config");
    const result = platformConfigSchema.safeParse(response.data);
    if (!result.success)
      throw new Error(
        "The server returned an unsupported configuration. Settings cannot be edited safely.",
      );
    return result.data;
  },

  async updateCommission(input: {
    commissionPct: number;
  }): Promise<{ commissionPct: number }> {
    const { commissionSchema } = await import("./platform-config-contract");
    const body = commissionSchema.parse(input);
    const response = await Api.patch<unknown>("/admin/config/commission", body);
    const result = commissionSchema.safeParse(response.data);
    if (!result.success || result.data.commissionPct !== body.commissionPct)
      throw new Error(UNCONFIRMED);
    return result.data;
  },

  async updateCancellationPolicy(
    input: Partial<CancellationPolicyDto>,
  ): Promise<CancellationPolicyDto> {
    const { cancellationPolicySchema } = await import("./platform-config-contract");
    const body = cancellationPolicySchema.partial().parse(input);
    const response = await Api.patch<unknown>(
      "/admin/config/cancellation-policy",
      body,
    );
    const result = cancellationPolicySchema.safeParse(response.data);
    if (
      !result.success ||
      Object.entries(body).some(
        ([key, value]) =>
          result.data[key as keyof CancellationPolicyDto] !== value,
      )
    )
      throw new Error(UNCONFIRMED);
    return result.data;
  },
};
