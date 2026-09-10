"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import {
  AgencyApi,
  agencyKeys,
  type UpdateAgencySettingsInput,
} from "@/features/agency/api";
import type { AgencySettings } from "@/shared/types/domain";
import { getErrorMessage } from "@/shared/api/errors";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Dialog } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";

/** Bounds mirrored from the backend `UpdateAgencySettingsDto`. */
const NAME_MAX = 160;
const DESCRIPTION_MAX = 2000;
const LOGO_URL_MAX = 500;
const CONDITIONS_MAX = 4000;
const DEPOSIT_NOTE_MAX = 1000;
const MIN_DRIVER_AGE_MIN = 18;
const MIN_DRIVER_AGE_MAX = 30;

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the agency name")
    .max(NAME_MAX, `At most ${NAME_MAX} characters`),
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX, `At most ${DESCRIPTION_MAX} characters`),
  logoUrl: z.union([
    z.literal(""),
    z.url("Enter a full URL (https://…)").max(LOGO_URL_MAX, "URL too long"),
  ]),
  rentalConditions: z
    .string()
    .trim()
    .max(CONDITIONS_MAX, `At most ${CONDITIONS_MAX} characters`),
  minDriverAge: z
    .string()
    .regex(/^\d{2}$/, "Enter an age")
    .refine(
      (v) =>
        Number(v) >= MIN_DRIVER_AGE_MIN && Number(v) <= MIN_DRIVER_AGE_MAX,
      `Between ${MIN_DRIVER_AGE_MIN} and ${MIN_DRIVER_AGE_MAX}`,
    ),
  depositNote: z
    .string()
    .trim()
    .max(DEPOSIT_NOTE_MAX, `At most ${DEPOSIT_NOTE_MAX} characters`),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

function profileDefaults(settings: AgencySettings): ProfileFormValues {
  return {
    name: settings.name,
    description: settings.description ?? "",
    logoUrl: settings.logoUrl ?? "",
    rentalConditions: settings.rentalConditions ?? "",
    minDriverAge: String(settings.minDriverAge),
    depositNote: settings.depositNote ?? "",
  };
}

function useSaveSettings(onSaved?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAgencySettingsInput) =>
      AgencyApi.updateSettings(input),
    onSuccess: (settings) => {
      qc.setQueryData(agencyKeys.settings(), settings);
      // Name/logo/conditions surface on the session banner and public pages.
      qc.invalidateQueries({ queryKey: agencyKeys.session() });
      onSaved?.();
    },
  });
}

/**
 * Profile + rental conditions. Saved as one PATCH; the whole form re-seeds
 * from the server response so what you see is what was stored (e.g. an
 * empty conditions box comes back as `null`).
 */
export function AgencyProfileForm({ settings }: { settings: AgencySettings }) {
  const [saved, setSaved] = useState(false);
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: profileDefaults(settings),
  });
  const mutation = useSaveSettings(() => setSaved(true));
  const errors = form.formState.errors;

  function submit(values: ProfileFormValues) {
    setSaved(false);
    mutation.mutate(
      {
        name: values.name,
        description: values.description,
        // An emptied logo field REMOVES the logo (`null` on the wire — the
        // DTO only validates a URL when a string is present).
        logoUrl: values.logoUrl || null,
        rentalConditions: values.rentalConditions,
        minDriverAge: Number(values.minDriverAge),
        depositNote: values.depositNote,
      },
      { onSuccess: (next) => form.reset(profileDefaults(next)) },
    );
  }

  const logoUrl = form.watch("logoUrl");

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>
            How your agency appears on its storefront and on every car page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="st-name">Agency name</Label>
            <Input
              id="st-name"
              maxLength={NAME_MAX}
              aria-invalid={!!errors.name}
              {...form.register("name")}
            />
            {errors.name ? (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="st-description">Description</Label>
            <Textarea
              id="st-description"
              placeholder="Tell customers who you are, where you operate and what makes your fleet different."
              maxLength={DESCRIPTION_MAX}
              aria-invalid={!!errors.description}
              {...form.register("description")}
            />
            {errors.description ? (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="st-logo">Logo URL</Label>
            <div className="flex items-center gap-3">
              {logoUrl && !errors.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
                />
              ) : null}
              <Input
                id="st-logo"
                type="url"
                placeholder="https://…/logo.png"
                maxLength={LOGO_URL_MAX}
                aria-invalid={!!errors.logoUrl}
                {...form.register("logoUrl")}
              />
            </div>
            {errors.logoUrl ? (
              <p className="text-sm text-destructive">
                {errors.logoUrl.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                A public image link (square works best). Clear the field to
                remove your logo.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rental conditions</CardTitle>
          <CardDescription>
            Shown on every car page and frozen into each booking&apos;s
            agreement when the customer requests it. Changing them never
            rewrites existing bookings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="st-conditions">Conditions</Label>
            <Textarea
              id="st-conditions"
              className="min-h-40"
              placeholder="Fuel policy, mileage limits, who may drive, cleaning fees, late-return charges…"
              maxLength={CONDITIONS_MAX}
              aria-invalid={!!errors.rentalConditions}
              {...form.register("rentalConditions")}
            />
            {errors.rentalConditions ? (
              <p className="text-sm text-destructive">
                {errors.rentalConditions.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="st-min-age">Minimum driver age</Label>
              <Input
                id="st-min-age"
                inputMode="numeric"
                aria-invalid={!!errors.minDriverAge}
                {...form.register("minDriverAge")}
              />
              {errors.minDriverAge ? (
                <p className="text-sm text-destructive">
                  {errors.minDriverAge.message}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Younger drivers cannot request your cars.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-deposit">Deposit note</Label>
              <Textarea
                id="st-deposit"
                placeholder="e.g. A refundable $200 deposit is held on the customer's card at pickup."
                maxLength={DEPOSIT_NOTE_MAX}
                aria-invalid={!!errors.depositNote}
                {...form.register("depositNote")}
              />
              {errors.depositNote ? (
                <p className="text-sm text-destructive">
                  {errors.depositNote.message}
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {mutation.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {getErrorMessage(mutation.error, "Could not save your settings.")}
        </p>
      ) : null}
      {saved && !form.formState.isDirty ? (
        <p className="text-sm text-success" role="status">
          Settings saved.
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={mutation.isPending || !form.formState.isDirty}
      >
        {mutation.isPending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

// ── Payout bank details ───────────────────────────────────────────────────────

/** Mirrors the backend `PayoutBankDetailsDto` (`currency` is always USD). */
const PAYOUT_CURRENCY = "USD";
const ACCOUNT_NUMBER_REGEX = /^[0-9A-Za-z-]{6,60}$/;

const bankSchema = z.object({
  bankName: z
    .string()
    .trim()
    .min(2, "Enter the bank name")
    .max(120, "At most 120 characters"),
  accountHolder: z
    .string()
    .trim()
    .min(2, "Enter the account holder")
    .max(160, "At most 160 characters"),
  accountNumber: z
    .string()
    .trim()
    .regex(ACCOUNT_NUMBER_REGEX, "6–60 letters, digits or dashes"),
  accountType: z.enum(["checking", "savings"]),
});
type BankFormValues = z.infer<typeof bankSchema>;

function bankDefaults(settings: AgencySettings): BankFormValues {
  const bank = settings.payoutBankDetails;
  return {
    bankName: bank?.bankName ?? "",
    accountHolder: bank?.accountHolder ?? "",
    accountNumber: bank?.accountNumber ?? "",
    accountType: bank?.accountType ?? "checking",
  };
}

/**
 * The bank account payouts are wired to. Separate form so the profile can be
 * saved without touching money settings; "Remove" sends `null` after a
 * confirmation (no bank account = no payout requests until re-added).
 */
export function PayoutBankDetailsForm({
  settings,
}: {
  settings: AgencySettings;
}) {
  const [saved, setSaved] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const form = useForm<BankFormValues>({
    resolver: zodResolver(bankSchema),
    defaultValues: bankDefaults(settings),
  });
  const mutation = useSaveSettings(() => setSaved(true));
  const remove = useSaveSettings(() => setSaved(false));
  const errors = form.formState.errors;
  const hasBank = settings.payoutBankDetails !== null;

  function submit(values: BankFormValues) {
    setSaved(false);
    mutation.mutate(
      { payoutBankDetails: { ...values, currency: PAYOUT_CURRENCY } },
      { onSuccess: (next) => form.reset(bankDefaults(next)) },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4 text-primary" />
          Payout bank account
        </CardTitle>
        <CardDescription>
          Where we send your earnings when a payout request is paid. Only
          staff with the settings permission can see this.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(submit)}
          noValidate
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bk-bank">Bank name</Label>
              <Input
                id="bk-bank"
                maxLength={120}
                placeholder="Banco Popular"
                aria-invalid={!!errors.bankName}
                {...form.register("bankName")}
              />
              {errors.bankName ? (
                <p className="text-sm text-destructive">
                  {errors.bankName.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bk-holder">Account holder</Label>
              <Input
                id="bk-holder"
                maxLength={160}
                placeholder="Legal name on the account"
                aria-invalid={!!errors.accountHolder}
                {...form.register("accountHolder")}
              />
              {errors.accountHolder ? (
                <p className="text-sm text-destructive">
                  {errors.accountHolder.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bk-number">Account number</Label>
              <Input
                id="bk-number"
                maxLength={60}
                autoComplete="off"
                aria-invalid={!!errors.accountNumber}
                {...form.register("accountNumber")}
              />
              {errors.accountNumber ? (
                <p className="text-sm text-destructive">
                  {errors.accountNumber.message}
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bk-type">Account type</Label>
                <Select id="bk-type" {...form.register("accountType")}>
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bk-currency">Currency</Label>
                <Input id="bk-currency" value={PAYOUT_CURRENCY} disabled readOnly />
              </div>
            </div>
          </div>

          {mutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {getErrorMessage(mutation.error, "Could not save the bank account.")}
            </p>
          ) : null}
          {remove.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {getErrorMessage(remove.error, "Could not remove the bank account.")}
            </p>
          ) : null}
          {saved && !form.formState.isDirty ? (
            <p className="text-sm text-success" role="status">
              Bank account saved.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={
                mutation.isPending || remove.isPending || !form.formState.isDirty
              }
            >
              {mutation.isPending
                ? "Saving…"
                : hasBank
                  ? "Update bank account"
                  : "Save bank account"}
            </Button>
            {hasBank ? (
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending || remove.isPending}
                onClick={() => setConfirmRemove(true)}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>

      <Dialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="Remove bank account?"
        description="You will not be able to request payouts until a bank account is added again. Pending payout requests are not affected."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmRemove(false)}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(
                { payoutBankDetails: null },
                {
                  onSuccess: (next) => {
                    form.reset(bankDefaults(next));
                    setConfirmRemove(false);
                  },
                },
              )
            }
          >
            {remove.isPending ? "Removing…" : "Remove bank account"}
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
