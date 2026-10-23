"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { CarFront, CircleCheck, IdCard } from "lucide-react";
import {
  AgenciesApi,
  applyKeys,
  type ApplyIndividualHostInput,
} from "@/features/agencies/api";
import {
  hostAddressSchema,
  hostPersonalSchema,
  latestHostDateOfBirthIso,
  type HostAddressValues,
  type HostPersonalValues,
} from "@/features/agencies/host-schemas";
import {
  useHostOnboardingStore,
  type HostLocalStep,
} from "@/features/agencies/host-onboarding-store";
import {
  AgencyDocumentUploader,
  type RequiredAgencyDocument,
} from "@/features/agencies/components/agency-document-uploader";
import { HostAgreementSigner } from "@/features/agencies/components/host-agreement-signer";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { useAgencySession } from "@/features/agency/hooks";
import { CarForm } from "@/features/agency/components/new-car-form";
import { CarRegistrationDocumentCard } from "@/features/agency/components/car-registration-document";
import { authKeys } from "@/features/auth/api";
import { TermsCheckbox } from "@/features/auth/components/terms-checkbox";
import { CatalogApi, catalogKeys } from "@/features/catalog/api";
import {
  buildIdIssuer,
  idNumberLabel,
  idNumberPlaceholder,
  isDominicanCedula,
  nationalIdNeedsSubdivision,
  normalizeIdNumber,
  ID_DOCUMENT_TYPES,
} from "@/features/agencies/identity-document";
import { useLegalCurrent } from "@/features/legal/hooks";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
} from "@/shared/api/errors";
import {
  AddressAutocomplete,
  type PickedAddress,
} from "@/shared/components/address-autocomplete";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import type { AgencyCar } from "@/shared/types/domain";
import { formatMoneyCents } from "@/shared/utils/money";

/**
 * `/become-host` — the five-step individual-host onboarding (ADR-0009):
 *
 *   1. personal data + Terms      ┐ local (zustand, persisted) — ONE
 *   2. pickup/delivery address    ┘ `POST /agencies/apply-individual`
 *   3. cédula front + back        → `POST /agencies/documents`
 *   4. host agreement             → `POST /agency/host-agreement/sign`
 *   5. first car + registration   → `POST /agency/fleet` + car document
 *
 * From step 3 on the SERVER decides where the host is: the wizard derives
 * the current step from the session, the uploaded documents, the agreement
 * status and the fleet, so a refresh (or a return visit days later) resumes
 * exactly where the host left off. Cars stay `draft` until an admin verifies
 * the host and the car's registration.
 *
 * Step 5 sits on the far side of verification: steps 1–4 are the application
 * itself and stay open to a pending host, but creating a car is a dashboard
 * write and a pending agency writes nothing (403
 * AGENCY_APPLICATION_UNDER_REVIEW). The wizard therefore closes at "we're
 * reviewing your application" and reopens at the car once the host is
 * verified.
 */

type WizardStep = HostLocalStep | "documents" | "agreement" | "car" | "done";

const STEPS: { key: Exclude<WizardStep, "done">; label: string }[] = [
  { key: "personal", label: "About you" },
  { key: "address", label: "Your address" },
  { key: "documents", label: "Your ID" },
  { key: "agreement", label: "Host agreement" },
  { key: "car", label: "Your first car" },
];

const HOST_DOCS: RequiredAgencyDocument[] = [
  {
    type: "owner_id",
    label: "Cédula — front",
    hint: "A clear, uncropped photo of the front of your cédula.",
  },
  {
    type: "owner_id_back",
    label: "Cédula — back",
    hint: "The back of the same cédula.",
  },
];

function stepIndex(step: WizardStep): number {
  return step === "done" ? STEPS.length : STEPS.findIndex((s) => s.key === step);
}

function StepIndicator({
  current,
  /** Step that cannot be reached yet — never drawn as done, whatever the
   *  current step is (the host is parked past it, waiting on verification). */
  locked,
}: {
  current: WizardStep;
  locked?: WizardStep;
}) {
  const currentIndex = stepIndex(current);
  return (
    <ol className="flex flex-wrap items-center gap-3 text-sm">
      {STEPS.map((s, i) => {
        const active = s.key === current;
        const done = i < currentIndex && s.key !== locked;
        return (
          <li key={s.key} className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <span
                className={
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " +
                  (active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-success-soft text-success"
                      : "bg-muted text-muted-foreground")
                }
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={
                  active ? "font-medium text-foreground" : "text-muted-foreground"
                }
              >
                {s.label}
              </span>
            </span>
            {i < STEPS.length - 1 ? (
              <span className="h-px w-6 bg-border" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function HostWizard({
  userId,
  isMember,
}: {
  userId: string;
  /** The caller already holds an agency role (the session store's view). */
  isMember: boolean;
}) {
  const store = useHostOnboardingStore();

  // Deferred hydration: the persisted draft is read after mount so server
  // and client render the same first frame; then it is bound to this user.
  useEffect(() => {
    void Promise.resolve(useHostOnboardingStore.persist.rehydrate()).then(() => {
      const s = useHostOnboardingStore.getState();
      s.bind(userId);
      s.setHydrated();
    });
  }, [userId]);

  // Right after a successful application the auth store still says
  // "customer" until `/users/me` is refetched — treat the caller as a member
  // locally so the wizard moves on without waiting.
  const [applied, setApplied] = useState(false);
  const member = isMember || applied;

  if (!store.hydrated) return <LoadingState label="Resuming your application…" />;

  if (!member) {
    return (
      <div className="space-y-6">
        <StepIndicator current={store.step} />
        {store.step === "personal" ? (
          <PersonalStep />
        ) : (
          <AddressStep onApplied={() => setApplied(true)} />
        )}
      </div>
    );
  }

  return <MemberSteps />;
}

/**
 * "We need one more thing before we can approve you."
 *
 * Shown while the application is still PENDING — asking is not a decision,
 * so nothing about the host's access changes and the wizard stays exactly
 * where it was. The note is the reviewer's own words, printed verbatim: it
 * names which document and what was wrong with it, and a paraphrase would
 * leave the host guessing.
 */
function DocumentsRequestedNotice({
  request,
  onReviewDocuments,
}: {
  request: { note: string; requestedAt: string } | null;
  onReviewDocuments: () => void;
}) {
  if (!request) return null;
  return (
    <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">
        We need one more thing
      </p>
      <p className="mt-1 text-sm text-amber-800">{request.note}</p>
      <p className="mt-2 text-xs text-amber-700">
        Your application stays open — upload it and we pick the review back
        up where we left off.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-3"
        onClick={onReviewDocuments}
      >
        Upload documents
      </Button>
    </div>
  );
}

// ── Step 1: personal data ─────────────────────────────────────────────────────

function PersonalStep() {
  const savePersonal = useHostOnboardingStore((s) => s.savePersonal);
  const draft = useHostOnboardingStore((s) => s.personal);
  const legal = useLegalCurrent();

  const form = useForm<HostPersonalValues>({
    resolver: zodResolver(hostPersonalSchema),
    defaultValues: draft ?? {
      firstName: "",
      lastName: "",
      idType: "national_id",
      idIssuerCountry: "",
      idIssuerSubdivision: "",
      idNumber: "",
      dateOfBirth: "",
      phone: "",
      acceptTerms: false,
    },
  });
  const errors = form.formState.errors;

  // The markets the platform serves. A national id card has to be issued by
  // the country the host lives and rents in, so this list is also the list
  // of countries whose national id we can accept at all.
  const countriesQuery = useQuery({
    queryKey: catalogKeys.countries(),
    queryFn: CatalogApi.listCountries,
  });

  const idType = form.watch("idType");
  const issuerCountry = form.watch("idIssuerCountry");
  const needsState =
    idType === "national_id" && nationalIdNeedsSubdivision(issuerCountry);

  // Only fetched when a state is actually being asked for.
  const regionsQuery = useQuery({
    queryKey: catalogKeys.regions(issuerCountry),
    queryFn: needsState
      ? () => CatalogApi.listRegions(issuerCountry)
      : skipToken,
  });

  // One market, one answer: pre-select it rather than make the host pick
  // from a list of one. They can still change it when there are more.
  const onlyCountry =
    countriesQuery.data?.length === 1 ? countriesQuery.data[0] : undefined;
  useEffect(() => {
    if (onlyCountry && !form.getValues("idIssuerCountry")) {
      form.setValue("idIssuerCountry", onlyCountry.code);
    }
  }, [onlyCountry, form]);

  const issuer = buildIdIssuer(
    idType,
    issuerCountry,
    form.watch("idIssuerSubdivision"),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">About you</CardTitle>
        <CardDescription>
          Your legal identity as the owner of the car(s) you will rent out.
          Renters see only your first name and last initial.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={form.handleSubmit((values) => savePersonal(values))}
          className="space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="host-first">First name</Label>
              <Input
                id="host-first"
                autoComplete="given-name"
                maxLength={80}
                aria-invalid={!!errors.firstName}
                {...form.register("firstName")}
              />
              {errors.firstName ? (
                <p className="text-sm text-destructive">{errors.firstName.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="host-last">Last name</Label>
              <Input
                id="host-last"
                autoComplete="family-name"
                maxLength={80}
                aria-invalid={!!errors.lastName}
                {...form.register("lastName")}
              />
              {errors.lastName ? (
                <p className="text-sm text-destructive">{errors.lastName.message}</p>
              ) : null}
            </div>
            {/* WHICH document, then WHO issued it, then the number — in that
                order, because each answer decides what the next one means.
                A cédula is 11 digits; a passport number is not. */}
            <div className="space-y-1.5">
              <Label htmlFor="host-id-type">ID document</Label>
              <Select
                id="host-id-type"
                aria-invalid={!!errors.idType}
                {...form.register("idType")}
              >
                {ID_DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
              {errors.idType ? (
                <p className="text-sm text-destructive">
                  {errors.idType.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="host-id-country">Issued by</Label>
              <Select
                id="host-id-country"
                disabled={countriesQuery.isLoading || countriesQuery.isError}
                aria-invalid={!!errors.idIssuerCountry}
                {...form.register("idIssuerCountry")}
              >
                <option value="">
                  {countriesQuery.isError
                    ? "Countries unavailable"
                    : "Select the issuing country"}
                </option>
                {(countriesQuery.data ?? []).map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {errors.idIssuerCountry ? (
                <p className="text-sm text-destructive">
                  {errors.idIssuerCountry.message}
                </p>
              ) : null}
            </div>

            {/* Asked only where it is a real question: the United States has
                no national id card, so "United States" alone names no
                issuing authority. */}
            {needsState ? (
              <div className="space-y-1.5">
                <Label htmlFor="host-id-state">Issuing state</Label>
                <Select
                  id="host-id-state"
                  disabled={regionsQuery.isLoading || regionsQuery.isError}
                  aria-invalid={!!errors.idIssuerSubdivision}
                  {...form.register("idIssuerSubdivision")}
                >
                  <option value="">
                    {regionsQuery.isError
                      ? "States unavailable"
                      : "Select the issuing state"}
                  </option>
                  {(regionsQuery.data ?? [])
                    .filter((r) => r.code)
                    .map((r) => (
                      <option key={r.id} value={r.code ?? ""}>
                        {r.name}
                      </option>
                    ))}
                </Select>
                {errors.idIssuerSubdivision ? (
                  <p className="text-sm text-destructive">
                    {errors.idIssuerSubdivision.message}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="host-id-number">
                {idNumberLabel(idType, issuer)}
              </Label>
              <Input
                id="host-id-number"
                inputMode={
                  isDominicanCedula(idType, issuer) ? "numeric" : "text"
                }
                placeholder={idNumberPlaceholder(idType, issuer)}
                maxLength={40}
                aria-invalid={!!errors.idNumber}
                {...form.register("idNumber")}
              />
              {errors.idNumber ? (
                <p className="text-sm text-destructive">{errors.idNumber.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Exactly as the document prints it; you will upload a photo
                  of it next.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="host-dob">Date of birth</Label>
              <Input
                id="host-dob"
                type="date"
                max={latestHostDateOfBirthIso()}
                aria-invalid={!!errors.dateOfBirth}
                {...form.register("dateOfBirth")}
              />
              {errors.dateOfBirth ? (
                <p className="text-sm text-destructive">{errors.dateOfBirth.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="host-phone">Phone</Label>
              <Input
                id="host-phone"
                type="tel"
                autoComplete="tel"
                placeholder="+1 809 555 0100"
                aria-invalid={!!errors.phone}
                {...form.register("phone")}
              />
              {errors.phone ? (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Shared with renters once a booking is confirmed.
                </p>
              )}
            </div>
          </div>

          <TermsCheckbox
            id="host-terms"
            inputProps={form.register("acceptTerms")}
            disabled={!legal.isSuccess}
            error={errors.acceptTerms?.message}
            hint={
              legal.isLoading ? (
                "Loading the current terms…"
              ) : legal.isError ? (
                <>
                  The current terms could not be loaded.{" "}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2"
                    onClick={() => legal.refetch()}
                  >
                    Try again
                  </button>
                </>
              ) : null
            }
          />

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!legal.isSuccess}>
              Continue
            </Button>
            <p className="text-xs text-muted-foreground">
              Next: where renters pick up the car.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Step 2: address (submits the application) ─────────────────────────────────

function describeApplyError(error: unknown): string {
  if (getApiErrorCode(error) === API_ERROR_CODES.TERMS_OUTDATED) {
    return "Our terms were updated while you were applying. Go back, accept the current version and submit again.";
  }
  return getErrorMessage(error, "Could not submit your application.");
}

function AddressStep({ onApplied }: { onApplied: () => void }) {
  const qc = useQueryClient();
  const personal = useHostOnboardingStore((s) => s.personal);
  const draft = useHostOnboardingStore((s) => s.address);
  const saveAddress = useHostOnboardingStore((s) => s.saveAddress);
  const goTo = useHostOnboardingStore((s) => s.goTo);
  const clear = useHostOnboardingStore((s) => s.clear);
  const legal = useLegalCurrent();

  const form = useForm<HostAddressValues>({
    resolver: zodResolver(hostAddressSchema),
    defaultValues: draft ?? {
      cityId: "",
      line: "",
      lat: null,
      lng: null,
      reference: "",
    },
  });
  const errors = form.formState.errors;
  const lat = form.watch("lat");
  const line = form.watch("line");

  /*
   * A NATIONAL ID CARD IS THE DOCUMENT OF THE COUNTRY YOU LIVE IN.
   *
   * The server refuses an application whose national id was issued
   * somewhere other than the country of the host's own address — that is
   * the hole that would otherwise let a Dominican host declare "a cédula
   * issued by Florida" and walk past the strict cédula format with any
   * string they liked.
   *
   * So the rule is enforced by the LIST rather than by a message: once the
   * host has said their national id is Dominican, only Dominican cities are
   * offered and a mismatch cannot be entered. A passport or a licence from
   * another country is ordinary — somebody who moved, or who drives on the
   * licence from home — so those narrow nothing.
   */
  const addressCountry =
    personal?.idType === "national_id" ? personal.idIssuerCountry : undefined;

  const citiesQuery = useQuery({
    queryKey: catalogKeys.cities(addressCountry),
    queryFn: () => CatalogApi.listCities(addressCountry),
  });

  const apply = useMutation({
    mutationFn: (input: ApplyIndividualHostInput) =>
      AgenciesApi.applyIndividual(input),
    onSuccess: () => {
      clear();
      // The caller now holds `agency_owner`: refresh the session snapshot and
      // every agency-scoped read the next steps depend on.
      qc.invalidateQueries({ queryKey: authKeys.me() });
      qc.invalidateQueries({ queryKey: agencyKeys.session() });
      qc.invalidateQueries({ queryKey: applyKeys.myDocuments() });
      onApplied();
    },
    onError: async (error) => {
      if (getApiErrorCode(error) === API_ERROR_CODES.TERMS_OUTDATED) {
        await legal.refetch();
      }
    },
  });

  function pickAddress(addr: PickedAddress) {
    form.setValue("line", addr.formattedAddress, {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.setValue("lat", addr.lat, { shouldValidate: true, shouldDirty: true });
    form.setValue("lng", addr.lng, { shouldValidate: true, shouldDirty: true });
  }

  function submit(values: HostAddressValues) {
    saveAddress(values);
    if (!personal || !legal.data || values.lat === null || values.lng === null) {
      return;
    }
    // The issuer the server will store, rebuilt from the two answers the
    // form asked separately (`US` + `FL` -> `US-FL`).
    const idIssuer = buildIdIssuer(
      personal.idType,
      personal.idIssuerCountry,
      personal.idIssuerSubdivision,
    );
    apply.mutate({
      firstName: personal.firstName,
      lastName: personal.lastName,
      idType: personal.idType,
      idIssuer,
      // Dashes are formatting in a cédula and part of the number anywhere
      // else — see `normalizeIdNumber`. Stripping them unconditionally, as
      // this did, would put a different licence number in a signed contract.
      idNumber: normalizeIdNumber(personal.idNumber, personal.idType, idIssuer),
      dateOfBirth: personal.dateOfBirth,
      phone: personal.phone,
      address: {
        cityId: values.cityId,
        line: values.line,
        lat: values.lat,
        lng: values.lng,
        ...(values.reference ? { reference: values.reference } : {}),
      },
      acceptTerms: true,
      termsVersion: legal.data.termsVersion,
    });
  }

  // A refresh can land here with the first step's draft gone (cleared
  // storage, another account) — send them back rather than submit half.
  if (!personal) {
    return (
      <ErrorState
        title="Let's start with your details"
        message="Your personal details are missing — fill them in first."
        onRetry={() => goTo("personal")}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">Your address</CardTitle>
        <CardDescription>
          Where renters pick up and return your car. It is also the starting
          point for door-to-door delivery, if you offer it later. Only the
          city is public; the exact address is shared once a booking is
          confirmed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={form.handleSubmit(submit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="host-city">City</Label>
            <Select
              id="host-city"
              disabled={citiesQuery.isLoading || citiesQuery.isError}
              aria-invalid={!!errors.cityId}
              {...form.register("cityId")}
            >
              <option value="">
                {citiesQuery.isError ? "Cities unavailable" : "Select your city"}
              </option>
              {(citiesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {errors.cityId ? (
              <p className="text-sm text-destructive">{errors.cityId.message}</p>
            ) : citiesQuery.isError ? (
              <button
                type="button"
                className="text-xs text-primary underline underline-offset-2"
                onClick={() => citiesQuery.refetch()}
              >
                Could not load cities — try again
              </button>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="host-search">Find your address</Label>
            <AddressAutocomplete
              id="host-search"
              placeholder={
                lat !== null
                  ? "Location set — search to change it"
                  : "Search your street address…"
              }
              onSelect={pickAddress}
            />
            {lat !== null ? (
              <p className="text-xs text-success">Location on file.</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="host-line">Address line</Label>
            <Input
              id="host-line"
              maxLength={300}
              placeholder="Filled in from the search — add apartment, floor, etc."
              aria-invalid={!!errors.line}
              {...form.register("line")}
            />
            {errors.line ? (
              <p className="text-sm text-destructive">{errors.line.message}</p>
            ) : line && lat === null ? (
              <p className="text-xs text-amber-600">
                Pick the address from the search suggestions so we can locate it.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="host-ref">Reference (optional)</Label>
            <Input
              id="host-ref"
              maxLength={300}
              placeholder="e.g. blue gate, next to the pharmacy"
              aria-invalid={!!errors.reference}
              {...form.register("reference")}
            />
            {errors.reference ? (
              <p className="text-sm text-destructive">{errors.reference.message}</p>
            ) : null}
          </div>

          {apply.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {describeApplyError(apply.error)}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={apply.isPending}
              onClick={() => {
                saveAddress(form.getValues());
                goTo("personal");
              }}
            >
              Back
            </Button>
            <Button type="submit" disabled={apply.isPending || !legal.isSuccess}>
              {apply.isPending ? "Submitting…" : "Submit application"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Next: upload your cédula.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Steps 3–5: server-derived ─────────────────────────────────────────────────

function MemberSteps() {
  const sessionQuery = useAgencySession();
  const documentsQuery = useQuery({
    queryKey: applyKeys.myDocuments(),
    queryFn: AgenciesApi.myDocuments,
  });
  const agreementQuery = useQuery({
    queryKey: agencyKeys.hostAgreement(),
    queryFn: AgencyApi.hostAgreement,
  });
  const fleetQuery = useQuery({
    queryKey: agencyKeys.fleet({ page: 1, pageSize: 1 }),
    queryFn: () => AgencyApi.fleet({ page: 1, pageSize: 1 }),
  });

  // Let the host revisit a completed step (e.g. replace a blurry cédula).
  const [visiting, setVisiting] = useState<"documents" | null>(null);
  // A registration uploaded moments ago counts even before the fleet refetch.
  const [registrationUploaded, setRegistrationUploaded] = useState(false);

  const queries = [sessionQuery, documentsQuery, agreementQuery, fleetQuery];
  // Per-query success checks (not `queries.some`) so TypeScript narrows every
  // result to its success variant below — the array form cannot.
  if (
    !sessionQuery.isSuccess ||
    !documentsQuery.isSuccess ||
    !agreementQuery.isSuccess ||
    !fleetQuery.isSuccess
  ) {
    const failed = queries.find((q) => q.isError);
    if (failed && !queries.some((q) => q.isLoading)) {
      return (
        <ErrorState
          title="Could not load your application"
          message={getErrorMessage(failed.error, "Please try again.")}
          onRetry={() => queries.forEach((q) => void q.refetch())}
        />
      );
    }
    return <LoadingState label="Resuming your application…" />;
  }

  const docs = documentsQuery.data;
  const docsComplete = HOST_DOCS.every((r) => docs.some((d) => d.type === r.type));
  const agreement = agreementQuery.data;
  const signed = agreement.signed !== null && !agreement.resignRequired;
  const car: AgencyCar | null = fleetQuery.data.items[0] ?? null;
  const registrationDone = !!car && (!!car.registration || registrationUploaded);
  const verified = sessionQuery.data.agency.verificationStatus === "verified";

  // The first-car step WRITES (`POST /agency/fleet` + the registration
  // document) and a pending applicant writes nothing — the backend answers
  // 403 AGENCY_APPLICATION_UNDER_REVIEW until an admin verifies them. So the
  // wizard parks at "waiting for review" after the signature and resumes at
  // the car once the host is verified, instead of offering a form that cannot
  // submit. The two steps still open to an applicant (ID documents, the
  // agreement) come first, so nothing earlier is blocked.
  const derived: WizardStep = !docsComplete
    ? "documents"
    : !signed
      ? "agreement"
      : !verified
        ? "done"
        : !car || !registrationDone
          ? "car"
          : "done";
  const step: WizardStep = visiting ?? derived;

  return (
    <div className="space-y-6">
      <StepIndicator current={step} locked={verified ? undefined : "car"} />

      {/* What the reviewer asked for, above everything — a host parked on
          "waiting for verification" would never think to look inside a step
          they already completed. The email is best-effort; this is not. */}
      <DocumentsRequestedNotice
        request={sessionQuery.data?.agency.documentsRequested ?? null}
        onReviewDocuments={() => setVisiting("documents")}
      />

      {step === "documents" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <IdCard className="h-4 w-4 text-primary" />
              Your ID
            </CardTitle>
            <CardDescription>
              Both sides of your cédula, so we can confirm you are the person
              on the application. Photos or PDFs, clear and uncropped.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AgencyDocumentUploader
              required={HOST_DOCS}
              existing={docs}
              idPrefix="host-doc"
            />
            {visiting ? (
              <Button type="button" onClick={() => setVisiting(null)}>
                Continue
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                The next step unlocks as soon as both sides are uploaded.
              </p>
            )}
          </CardContent>
        </Card>
      ) : step === "agreement" ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Host agreement</CardTitle>
            <CardDescription>
              Your agreement with the platform: what you commit to as a host,
              and how bookings, deposits, cancellations and payouts work. Read
              it, type your name and sign.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <HostAgreementSigner />
            <ReviewDocumentsLink onClick={() => setVisiting("documents")} />
          </CardContent>
        </Card>
      ) : step === "car" ? (
        <FirstCarStep
          car={car}
          onRegistrationUploaded={() => setRegistrationUploaded(true)}
          onReviewDocuments={() => setVisiting("documents")}
        />
      ) : (
        <DoneStep
          car={car}
          verified={verified}
          onReviewDocuments={() => setVisiting("documents")}
        />
      )}
    </div>
  );
}

function ReviewDocumentsLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      onClick={onClick}
    >
      Need to replace your ID photos? Review documents
    </button>
  );
}

function FirstCarStep({
  car,
  onRegistrationUploaded,
  onReviewDocuments,
}: {
  car: AgencyCar | null;
  onRegistrationUploaded: () => void;
  onReviewDocuments: () => void;
}) {
  // The host's single "Home" branch, created with the application.
  const branchesQuery = useQuery({
    queryKey: agencyKeys.branches(),
    queryFn: AgencyApi.branches,
    enabled: car === null,
  });

  if (car) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-soft text-success">
                <CarFront className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-foreground">
                  {car.make.name} {car.model.name} {car.year}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatMoneyCents(car.hostDailyRateCents)}/day · saved as a draft
                </p>
              </div>
            </div>
            <Link
              href={`/agency/fleet/${car.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Edit car
            </Link>
          </CardContent>
        </Card>
        <CarRegistrationDocumentCard
          carId={car.id}
          canUpload
          onUploaded={onRegistrationUploaded}
        />
        <ReviewDocumentsLink onClick={onReviewDocuments} />
      </div>
    );
  }

  if (branchesQuery.isLoading) {
    return <LoadingState label="Preparing your listing…" />;
  }
  const homeBranch = branchesQuery.data?.[0];
  if (branchesQuery.isError || !homeBranch) {
    return (
      <ErrorState
        title="Your pickup address is missing"
        message={
          branchesQuery.isError
            ? getErrorMessage(branchesQuery.error, "Please try again.")
            : "The address from your application was not found. Contact support."
        }
        onRetry={branchesQuery.isError ? () => branchesQuery.refetch() : undefined}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <CarFront className="h-4 w-4 text-primary" />
          Your first car
        </CardTitle>
        <CardDescription>
          Make and model come from the platform catalog. Add real photos of
          this exact car — the first one is the cover renters see. You will
          upload its registration card right after.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CarForm
          mode="create"
          fixedBranchId={homeBranch.id}
          submitLabel="Save car and continue"
          onCreated={() => undefined}
        />
        <ReviewDocumentsLink onClick={onReviewDocuments} />
      </CardContent>
    </Card>
  );
}

/**
 * End of the wizard. Two different endings: a VERIFIED host owns the
 * dashboard and their car; a PENDING one has finished everything they are
 * allowed to do and is waiting on the review — their car comes after it, so
 * this must not promise a draft they cannot create.
 */
function DoneStep({
  car,
  verified,
  onReviewDocuments,
}: {
  car: AgencyCar | null;
  verified: boolean;
  onReviewDocuments: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-4 p-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-sm font-medium text-success">
          <CircleCheck className="h-4 w-4" />
          {verified ? "You are a verified host" : "Application complete"}
        </span>
        <div>
          <h2 className="font-display text-lg text-foreground">
            {verified ? "You're all set" : "We're reviewing your application"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {verified
              ? "Publish your car from the dashboard whenever you are ready."
              : "Our team checks your ID and your details, usually within a few business days. We'll email you the decision — you add your first car as soon as you are verified."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/agency" className={buttonVariants({ variant: "default" })}>
            {verified ? "Go to your dashboard" : "See your application status"}
          </Link>
          {verified && car ? (
            <Link
              href={`/agency/fleet/${car.id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Manage your car
            </Link>
          ) : null}
        </div>
        <ReviewDocumentsLink onClick={onReviewDocuments} />
      </CardContent>
    </Card>
  );
}
