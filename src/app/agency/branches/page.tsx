"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { CatalogApi, catalogKeys } from "@/features/catalog/api";
import type { Branch } from "@/shared/types/domain";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  AddressAutocomplete,
  type PickedAddress,
} from "@/shared/components/address-autocomplete";
import { wholeUnitsToCents } from "@/shared/utils/money";
import { Select } from "@/shared/components/ui/select";

/**
 * /agency/branches — the agency's branches (city, address, phone). Cars belong
 * to a branch and search results come from branches in the searched city, so
 * this is the first thing an agency sets up. Includes create + activate/pause.
 */
export default function AgencyBranchesPage() {
  const [showForm, setShowForm] = useState(false);

  const query = useQuery({
    queryKey: agencyKeys.branches(),
    queryFn: AgencyApi.branches,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Branches</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "Add branch"}
        </Button>
      </div>

      {showForm ? (
        <NewBranchForm onDone={() => setShowForm(false)} />
      ) : null}

      <div className="mt-6">
        {query.isLoading ? (
          <LoadingState label="Loading branches…" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load branches"
            message={query.error.message}
            onRetry={() => query.refetch()}
          />
        ) : (query.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No branches yet"
            description="Add a branch so your cars have a pickup location and show up in city search."
            action={<Button onClick={() => setShowForm(true)}>Add branch</Button>}
          />
        ) : (
          <div className="space-y-3">
            {query.data!.map((b) => (
              <BranchRow key={b.id} branch={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BranchRow({ branch }: { branch: Branch }) {
  const qc = useQueryClient();

  const toggle = useMutation({
    mutationFn: () =>
      AgencyApi.updateBranch(branch.id, { isActive: !branch.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: agencyKeys.branches() }),
  });

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{branch.name}</p>
            <Badge variant={branch.isActive ? "success" : "secondary"}>
              {branch.isActive ? "Active" : "Paused"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {branch.address}
            {branch.city ? ` · ${branch.city.name}` : ""}
            {branch.phone ? ` · ${branch.phone}` : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={toggle.isPending}
          onClick={() => toggle.mutate()}
        >
          {toggle.isPending
            ? "Saving…"
            : branch.isActive
              ? "Pause"
              : "Activate"}
        </Button>
        {toggle.isError ? (
          <p className="w-full text-sm text-red-600">{toggle.error.message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function NewBranchForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [cityId, setCityId] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  // Delivery config
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [branchLoc, setBranchLoc] = useState<PickedAddress | null>(null);
  const [baseFee, setBaseFee] = useState("");
  const [perKm, setPerKm] = useState("");
  const [maxKm, setMaxKm] = useState("");

  const citiesQuery = useQuery({
    queryKey: catalogKeys.cities(),
    queryFn: CatalogApi.listCities,
  });

  const mutation = useMutation({
    mutationFn: () =>
      AgencyApi.createBranch({
        cityId,
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim() || undefined,
        ...(deliveryEnabled && branchLoc
          ? {
              deliveryEnabled: true,
              lat: branchLoc.lat,
              lng: branchLoc.lng,
              deliveryBaseFeeCents: wholeUnitsToCents(Number(baseFee) || 0),
              deliveryPerKmCents: wholeUnitsToCents(Number(perKm) || 0),
              deliveryMaxKm: maxKm ? Number(maxKm) : undefined,
            }
          : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agencyKeys.branches() });
      onDone();
    },
  });

  const deliveryReady = !deliveryEnabled || (!!branchLoc && !!baseFee && !!perKm);
  const ready =
    !!cityId &&
    name.trim().length >= 2 &&
    address.trim().length >= 5 &&
    deliveryReady;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">New branch</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="br-city">City</Label>
            <Select
              id="br-city"
              value={cityId}
              disabled={citiesQuery.isLoading || citiesQuery.isError}
              onChange={(e) => setCityId(e.target.value)}
            >
              <option value="">
                {citiesQuery.isError ? "Cities unavailable" : "Select a city"}
              </option>
              {(citiesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="br-name">Branch name</Label>
            <Input
              id="br-name"
              placeholder="Main office"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="br-address">Address</Label>
            <Input
              id="br-address"
              placeholder="Av. 27 de Febrero 123"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="br-phone">Phone (optional)</Label>
            <Input
              id="br-phone"
              type="tel"
              placeholder="+1 809 555 0100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        {/* ── Door-to-door delivery ─────────────────────────────────────── */}
        <div className="mt-4 rounded-[var(--radius-sm)] border border-border p-3.5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={deliveryEnabled}
              onChange={(e) => setDeliveryEnabled(e.target.checked)}
            />
            Offer door-to-door delivery from this branch
          </label>
          {deliveryEnabled ? (
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="br-loc">
                  Branch location (sets the delivery origin)
                </Label>
                <AddressAutocomplete
                  id="br-loc"
                  placeholder="Search the branch's location…"
                  onSelect={setBranchLoc}
                  onClear={() => setBranchLoc(null)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="br-base">Base fee</Label>
                  <Input
                    id="br-base"
                    type="number"
                    min={0}
                    placeholder="200"
                    value={baseFee}
                    onChange={(e) => setBaseFee(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="br-perkm">Per km</Label>
                  <Input
                    id="br-perkm"
                    type="number"
                    min={0}
                    placeholder="50"
                    value={perKm}
                    onChange={(e) => setPerKm(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="br-maxkm">Max km (optional)</Label>
                  <Input
                    id="br-maxkm"
                    type="number"
                    min={1}
                    placeholder="30"
                    value={maxKm}
                    onChange={(e) => setMaxKm(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Fee = base + per-km × distance from the branch to the
                customer&apos;s address. Amounts are in whole units.
              </p>
            </div>
          ) : null}
        </div>

        {mutation.isError ? (
          <p className="mt-3 text-sm text-red-600">{mutation.error.message}</p>
        ) : null}

        <Button
          className="mt-4"
          disabled={!ready || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Creating…" : "Create branch"}
        </Button>
      </CardContent>
    </Card>
  );
}
