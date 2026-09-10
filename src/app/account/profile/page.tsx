"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthApi, authKeys } from "@/features/auth/api";
import { PHONE_MESSAGE, PHONE_REGEX } from "@/features/auth/schemas";
import { useAuthStore } from "@/shared/auth/store";
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
 * /account/profile — edit the safe profile fields (name/phone) via
 * PATCH /users/me. Email is the login identifier and stays read-only.
 * On save the auth store + the /users/me cache are refreshed so the
 * header greeting and every consumer pick up the new name at once.
 */
export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: "", phone: "" },
  });

  useEffect(() => {
    if (user) {
      form.reset({ fullName: user.fullName, phone: user.phone ?? "" });
    }
  }, [user, form]);

  const mutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      AuthApi.updateMe({
        fullName: values.fullName.trim(),
        // Empty string means "clear my phone" — the API takes null for that.
        phone: values.phone?.trim() || null,
      }),
    onSuccess: (updated) => {
      setUser(updated); // header greeting etc. update immediately
      qc.invalidateQueries({ queryKey: authKeys.me() });
      form.reset({ fullName: updated.fullName, phone: updated.phone ?? "" });
    },
  });

  const saved = mutation.isSuccess && !form.formState.isDirty;

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your contact information.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={user?.email ?? ""} disabled readOnly />
            <p className="text-xs text-muted-foreground">
              Email changes require support (login identifier).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Full name</Label>
            <Input id="profile-name" {...form.register("fullName")} />
            {form.formState.errors.fullName ? (
              <p className="text-sm text-red-600">
                {form.formState.errors.fullName.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-phone">Phone</Label>
            <Input id="profile-phone" type="tel" {...form.register("phone")} />
            {form.formState.errors.phone ? (
              <p className="text-sm text-red-600">
                {form.formState.errors.phone.message}
              </p>
            ) : null}
          </div>

          {mutation.isError ? (
            <p className="text-sm text-red-600">{mutation.error.message}</p>
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
  );
}
