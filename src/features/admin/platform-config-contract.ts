import { z } from "zod";

export const commissionSchema = z.object({
  commissionPct: z.number().min(0).max(100),
});

export const cancellationPolicySchema = z.object({
  freeCancellationHours: z.number().int().min(0).max(720),
  lateCancellationRetentionPct: z.number().int().min(0).max(100),
  earlyReturnPenaltyDays: z.number().int().min(0).max(30),
});

// Read the deployed shape and the announced flat shape during the rollout.
// Only the four settings with existing write endpoints are editable.
export const platformConfigSchema = z.union([
  commissionSchema.extend({ cancellationPolicy: cancellationPolicySchema }),
  commissionSchema
    .extend(cancellationPolicySchema.shape)
    .transform((config) => ({
      commissionPct: config.commissionPct,
      cancellationPolicy: cancellationPolicySchema.parse(config),
    })),
]);

function integerInput(max: number) {
  return z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number")
    .refine((value) => Number(value) <= max, {
      message: `Between 0 and ${max}`,
    });
}

export const commissionFormSchema = z.object({
  commissionPct: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a percentage (up to 2 decimals)")
    .refine((value) => Number(value) <= 100, { message: "Between 0 and 100" }),
});

export const cancellationFormSchema = z.object({
  freeCancellationHours: integerInput(720),
  lateCancellationRetentionPct: integerInput(100),
  earlyReturnPenaltyDays: integerInput(30),
});
