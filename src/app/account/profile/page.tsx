"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  phone: z.string().min(7, "Enter a valid phone").optional().or(z.literal("")),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

/**
 * /account/profile — profile form skeleton. The save wiring (PATCH
 * /users/me expected) lands with the profile iteration; the form itself
 * is fully validated already.
 */
export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: "", phone: "" },
  });

  useEffect(() => {
    if (user) {
      form.reset({ fullName: user.fullName, phone: user.phone ?? "" });
    }
  }, [user, form]);

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your contact information.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(() => {
            // TODO(integrator): PATCH /users/me { fullName, phone }
          })}
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

          <Button type="submit" disabled title="Save endpoint lands with the profile iteration">
            Save changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
