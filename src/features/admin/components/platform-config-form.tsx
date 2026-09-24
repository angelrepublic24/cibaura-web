"use client";

import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminApi, adminKeys } from "@/features/admin/api";
import {
  commissionFormSchema,
  cancellationFormSchema,
} from "@/features/admin/platform-config-contract";
import { legalKeys } from "@/features/legal/api";
import { getErrorMessage } from "@/shared/api/errors";
import type {
  CancellationPolicyDto,
  PlatformConfigDto,
} from "@/shared/types/domain";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

type CommissionValues = z.infer<typeof commissionFormSchema>;
type PolicyValues = z.infer<typeof cancellationFormSchema>;

const POLICY_FIELDS = [
  {
    name: "freeCancellationHours",
    label: "Free cancellation",
    hint: "Hours before pickup. 0 - 720.",
  },
  {
    name: "lateCancellationRetentionPct",
    label: "Late cancellation retention",
    hint: "Percentage retained. 0 - 100.",
  },
  {
    name: "earlyReturnPenaltyDays",
    label: "Early return penalty",
    hint: "Days charged as a penalty. 0 - 7.",
  },
] as const;

function policyDefaults(policy: CancellationPolicyDto): PolicyValues {
  return {
    freeCancellationHours: String(policy.freeCancellationHours),
    lateCancellationRetentionPct: String(policy.lateCancellationRetentionPct),
    earlyReturnPenaltyDays: String(policy.earlyReturnPenaltyDays),
  };
}

/** Separate saves match the two deployed endpoints; neither implies the other succeeded. */
export function PlatformConfigForm({ config }: { config: PlatformConfigDto }) {
  return (
    <div className="space-y-6">
      <CommissionForm config={config} />
      <CancellationForm policy={config.cancellationPolicy} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Additional settings unavailable
          </CardTitle>
          <CardDescription>
            These settings cannot currently be edited or saved here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Dispute window and customer claim response window</li>
            <li>Default security deposit and re-authorization lead time</li>
            <li>
              Advance at confirmed check-in
              {config.checkinAdvancePct !== undefined
                ? `: ${config.checkinAdvancePct}% (read-only)`
                : ": current value unavailable"}
            </li>
            <li>Required inspections, minimum photos and media retention</li>
            <li>Stripe payouts</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function CommissionForm({ config }: { config: PlatformConfigDto }) {
  const id = useId();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const form = useForm<CommissionValues>({
    resolver: zodResolver(commissionFormSchema),
    defaultValues: { commissionPct: String(config.commissionPct) },
  });
  const mutation = useMutation({
    mutationFn: AdminApi.updateCommission,
    onSuccess: (next) => {
      qc.setQueryData<PlatformConfigDto>(adminKeys.config(), (previous) =>
        previous
          ? { ...previous, commissionPct: next.commissionPct }
          : previous,
      );
      form.reset({ commissionPct: String(next.commissionPct) });
      setSaved(true);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.config() });
    },
  });
  const dirty = form.formState.isDirty;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Commission</CardTitle>
        <CardDescription>
          Applied to new bookings. Editing it never changes existing bookings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onChange={() => setSaved(false)}
          onSubmit={form.handleSubmit((values) => {
            setSaved(false);
            mutation.mutate({ commissionPct: Number(values.commissionPct) });
          })}
        >
          <fieldset disabled={mutation.isPending} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={id}>Commission (%)</Label>
              <Input
                id={id}
                inputMode="decimal"
                className="max-w-[140px]"
                aria-invalid={!!form.formState.errors.commissionPct}
                {...form.register("commissionPct")}
              />
              <p className="text-xs text-muted-foreground">
                0 - 100, up to two decimals.
              </p>
              {form.formState.errors.commissionPct && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.commissionPct.message}
                </p>
              )}
            </div>
            <SaveActions
              label="commission"
              busy={mutation.isPending}
              dirty={dirty}
              saved={saved}
              error={mutation.error}
              onDiscard={() => {
                form.reset({ commissionPct: String(config.commissionPct) });
                setSaved(false);
                mutation.reset();
              }}
            />
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

function CancellationForm({ policy }: { policy: CancellationPolicyDto }) {
  const id = useId();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const form = useForm<PolicyValues>({
    resolver: zodResolver(cancellationFormSchema),
    defaultValues: policyDefaults(policy),
  });
  const mutation = useMutation({
    mutationFn: AdminApi.updateCancellationPolicy,
    onSuccess: (next) => {
      qc.setQueryData<PlatformConfigDto>(adminKeys.config(), (previous) =>
        previous ? { ...previous, cancellationPolicy: next } : previous,
      );
      form.reset(policyDefaults(next));
      setSaved(true);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.config() });
      void qc.invalidateQueries({ queryKey: legalKeys.all });
    },
  });
  const dirty = form.formState.isDirty;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cancellation policy</CardTitle>
        <CardDescription>
          Published to customers through the legal pages. Saved separately from
          commission.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onChange={() => setSaved(false)}
          onSubmit={form.handleSubmit((values) => {
            setSaved(false);
            const patch: Partial<CancellationPolicyDto> = {};
            for (const { name } of POLICY_FIELDS) {
              if (form.formState.dirtyFields[name])
                patch[name] = Number(values[name]);
            }
            if (Object.keys(patch).length) mutation.mutate(patch);
          })}
        >
          <fieldset disabled={mutation.isPending} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {POLICY_FIELDS.map(({ name, label, hint }) => (
                <div key={name} className="space-y-1.5">
                  <Label htmlFor={`${id}-${name}`}>{label}</Label>
                  <Input
                    id={`${id}-${name}`}
                    inputMode="numeric"
                    aria-invalid={!!form.formState.errors[name]}
                    {...form.register(name)}
                  />
                  <p className="text-xs text-muted-foreground">{hint}</p>
                  {form.formState.errors[name] && (
                    <p role="alert" className="text-sm text-destructive">
                      {form.formState.errors[name]?.message}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <SaveActions
              label="cancellation policy"
              busy={mutation.isPending}
              dirty={dirty}
              saved={saved}
              error={mutation.error}
              onDiscard={() => {
                form.reset(policyDefaults(policy));
                setSaved(false);
                mutation.reset();
              }}
            />
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

function SaveActions({
  label,
  busy,
  dirty,
  saved,
  error,
  onDiscard,
}: {
  label: string;
  busy: boolean;
  dirty: boolean;
  saved: boolean;
  error: Error | null;
  onDiscard: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={!dirty || busy}>
        {busy ? "Saving..." : `Save ${label}`}
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={!dirty || busy}
        onClick={onDiscard}
      >
        Discard changes
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {getErrorMessage(error, `Could not save ${label}.`)}
        </p>
      ) : saved && !dirty ? (
        <p className="text-sm text-success" role="status">
          {label === "commission"
            ? "Commission saved."
            : "Cancellation policy saved."}
        </p>
      ) : null}
    </div>
  );
}
