"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { authKeys, useUpdateMe } from "@/modules/auth/hooks/auth.hook";
import {
  PHONE_MESSAGE,
  PHONE_REGEX,
} from "@/modules/auth/schema/auth.schema";
import { ChangePasswordForm } from "@/modules/auth/components/change-password-form";
import { DeleteAccountCard } from "@/modules/auth/components/delete-account-card";
import { useAuthStore } from "@/shared/auth/store";
import { getErrorMessage } from "@/shared/api/errors";
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

const profileSchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  // Same rule the backend enforces (UpdateMeDto) — fail fast client-side.
  phone: z
    .string()
    .regex(PHONE_REGEX, PHONE_MESSAGE)
    .optional()
    .or(z.literal("")),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

/**
 * /account/profile — three cards:
 *  1. contact details (name/phone via PATCH /users/me; email is the login
 *     identifier and stays read-only),
 *  2. change password (shared `ChangePasswordForm`),
 *  3. delete account (danger zone, password-confirmed modal).
 * On save the auth store + the /users/me cache are refreshed so the header
 * greeting and every consumer pick up the new name at once.
 */
export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: "", phone: "" },
  });

  // Seed the form from the store ONCE per account. Later store updates (the
  // focus/interval refetch of /users/me re-setting an equal user object)
  // only re-seed while the form is pristine — never over unsaved edits.
  const seededForUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!user) return;
    const sameAccount = seededForUserId.current === user.id;
    if (sameAccount && form.formState.isDirty) return;
    form.reset({ fullName: user.fullName, phone: user.phone ?? "" });
    seededForUserId.current = user.id;
  }, [user, form]);

  // The component talks to the module's HOOK, never to the service: the hook
  // owns the mutation and `authKeys`, and leaves the caller to mirror the
  // result where this page needs it (store + /users/me cache + form).
  const mutation = useUpdateMe();

  function save(values: ProfileFormValues) {
    mutation.mutate(
      {
        fullName: values.fullName.trim(),
        // Empty string means "clear my phone" — the API takes null for that.
        phone: values.phone?.trim() || null,
      },
      {
        onSuccess: (updated) => {
          setUser(updated); // header greeting etc. update immediately
          qc.invalidateQueries({ queryKey: authKeys.me() });
          form.reset({
            fullName: updated.fullName,
            phone: updated.phone ?? "",
          });
        },
      },
    );
  }

  const saved = mutation.isSuccess && !form.formState.isDirty;

  return (
    <div className="space-y-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your contact information.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(save)}
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                value={user?.email ?? ""}
                disabled
                readOnly
              />
              <p className="text-xs text-muted-foreground">
                Email changes require support (login identifier).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Full name</Label>
              <Input
                id="profile-name"
                aria-invalid={!!form.formState.errors.fullName}
                {...form.register("fullName")}
              />
              {form.formState.errors.fullName ? (
                <p className="text-sm text-red-600">
                  {form.formState.errors.fullName.message}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Used as the renter name on your rental agreements — make sure
                it matches your driver&apos;s license.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-phone">Phone</Label>
              <Input
                id="profile-phone"
                type="tel"
                aria-invalid={!!form.formState.errors.phone}
                {...form.register("phone")}
              />
              {form.formState.errors.phone ? (
                <p className="text-sm text-red-600">
                  {form.formState.errors.phone.message}
                </p>
              ) : null}
            </div>

            {mutation.isError ? (
              <p className="text-sm text-red-600" role="alert">
                {getErrorMessage(
                  mutation.error,
                  "Could not save your profile. Please try again.",
                )}
              </p>
            ) : null}
            {saved ? (
              <p className="text-sm text-primary" role="status">
                Profile saved.
              </p>
            ) : null}

            <Button type="submit" disabled={mutation.isPending || !user}>
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ChangePasswordForm />

      <DeleteAccountCard />
    </div>
  );
}
