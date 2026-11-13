"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, IdCard, LockKeyhole } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { authKeys, useMe, useUpdateMe } from "@/modules/auth/hooks/auth.hook";
import { PHONE_MESSAGE, PHONE_REGEX } from "@/modules/auth/schema/auth.schema";
import { useCities, useCountries } from "@/modules/catalog/hooks/catalog.hook";
import { verificationKeys } from "@/modules/verification/hooks/verification.hook";
import { dateOfBirthField } from "@/modules/verification/schema/verification.schema";
import { maxDateOfBirthIso } from "@/modules/verification/helpers/verification.helper";
import { useAuthStore } from "@/shared/auth/store";
import { getErrorMessage } from "@/shared/api/errors";
import { accountInitials } from "@/shared/helpers/account-navigation";
import { Button } from "@/shared/components/ui/button";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { SettingsEditorRow, SettingsPageTitle } from "./settings-section";
import type { User } from "@/shared/types/domain";

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name"),
  phone: z.string().regex(PHONE_REGEX, PHONE_MESSAGE).or(z.literal("")),
  dateOfBirth: dateOfBirthField.or(z.literal("")),
  countryId: z.string(),
  cityId: z.string(),
});
type Values = z.infer<typeof profileSchema>;
const defaults = (user: User): Values => ({
  fullName: user.fullName,
  phone: user.phone ?? "",
  dateOfBirth: user.dateOfBirth ?? "",
  countryId: user.countryId ?? "",
  cityId: user.cityId ?? "",
});

export function ProfilePanel() {
  const profile = useMe();
  const user = profile.data;
  const setUser = useAuthStore((state) => state.setUser);
  const qc = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      dateOfBirth: "",
      countryId: "",
      cityId: "",
    },
  });
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!user || (seededFor.current === user.id && form.formState.isDirty))
      return;
    form.reset(defaults(user));
    seededFor.current = user.id;
  }, [user, form]);
  const mutation = useUpdateMe();
  const countries = useCountries();
  const countryId = form.watch("countryId");
  const selectedCountry = countries.data?.find(
    (country) => country.id === countryId,
  );
  const cities = useCities(selectedCountry?.code);
  const availableCities =
    cities.data?.filter((city) => city.countryId === countryId) ?? [];

  if (profile.isError)
    return (
      <ErrorState
        title="Could not load your profile"
        message={getErrorMessage(profile.error, "Please try again.")}
        onRetry={() => profile.refetch()}
      />
    );
  if (!user) return <LoadingState label="Loading your profile…" />;
  const onFile = Boolean(user.dateOfBirth);
  function save(values: Values) {
    mutation.mutate(
      {
        fullName: values.fullName.trim(),
        phone: values.phone.trim() || null,
        countryId: values.countryId || null,
        cityId: values.cityId || null,
        ...(!onFile && values.dateOfBirth
          ? { dateOfBirth: values.dateOfBirth }
          : {}),
      },
      {
        onSuccess: (updated) => {
          setUser(updated);
          qc.setQueryData(authKeys.me(), updated);
          void qc.invalidateQueries({ queryKey: verificationKeys.all });
          form.reset(defaults(updated));
        },
      },
    );
  }
  const errors = form.formState.errors;
  return (
    <div className="w-full">
      <SettingsPageTitle
        title="Personal profile"
        description="The essentials for your next rental."
      />
      <form onSubmit={form.handleSubmit(save)} noValidate>
        <section className="settings-profile-intro">
          <span className="settings-avatar" aria-hidden="true">
            {accountInitials(user.fullName, user.email)}
          </span>
          <div>
            <h3>{user.fullName}</h3>
            <p>{user.email}</p>
          </div>
        </section>
        <SettingsEditorRow
          number="01"
          title="Personal details"
          description="Your identity and driver age."
        >
          <div className="settings-fields">
            <label className="settings-field" htmlFor="profile-name">
              Full name
              <input
                id="profile-name"
                autoComplete="name"
                aria-invalid={!!errors.fullName}
                {...form.register("fullName")}
              />
              <small>Match the name on your driver&apos;s license.</small>
              {errors.fullName && (
                <span className="text-destructive">
                  {errors.fullName.message}
                </span>
              )}
            </label>
            <label className="settings-field" htmlFor="profile-dob">
              Date of birth
              <input
                id="profile-dob"
                type="date"
                max={maxDateOfBirthIso()}
                autoComplete="bday"
                readOnly={onFile}
                aria-invalid={!!errors.dateOfBirth}
                {...form.register("dateOfBirth")}
              />
              <small>
                {onFile ? (
                  <>
                    On file.{" "}
                    <Link href="/support" className="underline">
                      Contact support
                    </Link>{" "}
                    to correct it.
                  </>
                ) : (
                  "Add your date of birth before submitting your license. Once saved, corrections require support."
                )}
              </small>
              {errors.dateOfBirth && (
                <span className="text-destructive">
                  {errors.dateOfBirth.message}
                </span>
              )}
            </label>
          </div>
        </SettingsEditorRow>
        <SettingsEditorRow
          number="02"
          title="Contact information"
          description="For your account and rental updates."
        >
          <div className="settings-fields">
            <label className="settings-field" htmlFor="profile-email">
              Email address
              <input
                id="profile-email"
                type="email"
                value={user.email}
                readOnly
              />
              <small>
                <Link href="/support" className="underline">
                  Contact support
                </Link>{" "}
                to update your login email.
              </small>
            </label>
            <label className="settings-field" htmlFor="profile-phone">
              Phone number
              <input
                id="profile-phone"
                type="tel"
                autoComplete="tel"
                aria-invalid={!!errors.phone}
                {...form.register("phone")}
              />
              <small>Include your country code.</small>
              {errors.phone && (
                <span className="text-destructive">{errors.phone.message}</span>
              )}
            </label>
          </div>
        </SettingsEditorRow>
        <SettingsEditorRow
          number="03"
          title="Where you live"
          description="Optional. No street address needed."
        >
          <div className="settings-fields">
            <label className="settings-field" htmlFor="profile-country">
              Country of residence
              <select
                id="profile-country"
                {...form.register("countryId", {
                  onChange: () =>
                    form.setValue("cityId", "", { shouldDirty: true }),
                })}
                disabled={countries.isPending || countries.isError}
              >
                <option value="">Not specified</option>
                {countries.data?.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
              {countries.isError && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => countries.refetch()}
                >
                  Retry countries
                </Button>
              )}
            </label>
            <label className="settings-field" htmlFor="profile-city">
              City
              <select
                id="profile-city"
                {...form.register("cityId")}
                disabled={
                  !selectedCountry || cities.isPending || cities.isError
                }
              >
                <option value="">Not specified</option>
                {availableCities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
              {cities.isError && selectedCountry && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => cities.refetch()}
                >
                  Retry cities
                </Button>
              )}
            </label>
          </div>
        </SettingsEditorRow>
        {mutation.isError && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {getErrorMessage(
              mutation.error,
              "Could not save your profile. Please try again.",
            )}
          </p>
        )}
        {mutation.isSuccess && !form.formState.isDirty && (
          <p className="mt-4 text-sm text-success" role="status">
            Profile saved.
          </p>
        )}
        <div className="settings-editor-actions">
          <p>
            <LockKeyhole aria-hidden="true" />
            Your personal details are private.
          </p>
          <div className="settings-action-buttons">
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                form.reset(defaults(user));
                mutation.reset();
              }}
            >
              Discard
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </form>
      <section className="settings-next-step">
        <IdCard aria-hidden="true" />
        <div>
          <h3>Ready to verify your license?</h3>
          <p>
            Your license number, expiration date and photos live together in
            Documents.
          </p>
        </div>
        <Link href="/account/settings/documents">
          Open documents <ArrowRight aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
