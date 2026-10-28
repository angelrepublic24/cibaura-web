import { wholeUnitsToCents } from "@/shared/utils/money";
import type {
  ContractKind,
  ContractTemplateStatus,
} from "@/shared/types/domain";
import type {
  DirtyConfigFields,
  PlatformConfig,
  PlatformConfigFormValues,
  PlatformConfigPatch,
} from "@/modules/admin/types/admin.types";

/**
 * Pure admin helpers: the platform-config form ↔ wire mapping and (below)
 * the contract-template vocabulary. Nothing here talks to the network or to
 * React.
 */

// ── Platform configuration ──────────────────────────────────────────────────

/**
 * Seed the form from what the server stored. Numbers become the strings their
 * inputs hold; `String(15.125)` keeps the extra precision visible rather than
 * quietly rewriting a value nobody asked to change.
 */
export function configToFormValues(
  config: PlatformConfig,
): PlatformConfigFormValues {
  return {
    commissionPct: String(config.commissionPct),
    freeCancellationHours: String(config.freeCancellationHours),
    lateCancellationRetentionPct: String(config.lateCancellationRetentionPct),
    earlyReturnPenaltyDays: String(config.earlyReturnPenaltyDays),
    disputeWindowHours: String(config.disputeWindowHours),
    claimResponseHours: String(config.claimResponseHours),
    defaultDepositUnits: String(config.defaultDepositCents / 100),
    taxRatePct: String(config.taxRatePct),
    taxBase: config.taxBase,
    checkinAdvancePct: String(config.checkinAdvancePct),
    depositReauthLeadHours: String(config.depositReauthLeadHours),
    inspectionsRequired: config.inspectionsRequired,
    inspectionMinPhotos: String(config.inspectionMinPhotos),
    inspectionMediaRetentionMonths: String(
      config.inspectionMediaRetentionMonths,
    ),
    stripePayoutsEnabled: config.stripePayoutsEnabled,
  };
}

/**
 * The DIFF to send: only the fields the admin actually changed, converted to
 * the units the wire uses. Written out field by field on purpose — a generic
 * mapping would need a cast to reconcile the string form values with the
 * numeric wire ones, and a cast is exactly where a unit conversion goes
 * missing.
 */
export function formValuesToPatch(
  values: PlatformConfigFormValues,
  dirty: DirtyConfigFields,
): PlatformConfigPatch {
  const patch: PlatformConfigPatch = {};
  if (dirty.commissionPct) patch.commissionPct = Number(values.commissionPct);
  if (dirty.freeCancellationHours)
    patch.freeCancellationHours = Number(values.freeCancellationHours);
  if (dirty.lateCancellationRetentionPct)
    patch.lateCancellationRetentionPct = Number(
      values.lateCancellationRetentionPct,
    );
  if (dirty.earlyReturnPenaltyDays)
    patch.earlyReturnPenaltyDays = Number(values.earlyReturnPenaltyDays);
  if (dirty.disputeWindowHours)
    patch.disputeWindowHours = Number(values.disputeWindowHours);
  if (dirty.claimResponseHours)
    patch.claimResponseHours = Number(values.claimResponseHours);
  if (dirty.defaultDepositUnits)
    patch.defaultDepositCents = wholeUnitsToCents(
      Number(values.defaultDepositUnits),
    );
  if (dirty.taxRatePct) patch.taxRatePct = Number(values.taxRatePct);
  if (dirty.taxBase) patch.taxBase = values.taxBase;
  if (dirty.checkinAdvancePct)
    patch.checkinAdvancePct = Number(values.checkinAdvancePct);
  if (dirty.depositReauthLeadHours)
    patch.depositReauthLeadHours = Number(values.depositReauthLeadHours);
  if (dirty.inspectionsRequired)
    patch.inspectionsRequired = values.inspectionsRequired;
  if (dirty.inspectionMinPhotos)
    patch.inspectionMinPhotos = Number(values.inspectionMinPhotos);
  if (dirty.inspectionMediaRetentionMonths)
    patch.inspectionMediaRetentionMonths = Number(
      values.inspectionMediaRetentionMonths,
    );
  if (dirty.stripePayoutsEnabled)
    patch.stripePayoutsEnabled = values.stripePayoutsEnabled;
  return patch;
}

// ── Contract templates (ADR-0010, spec §4/B7) ───────────────────────────────

/**
 * The variable catalog is SERVER-DEFINED — this mirror only drives the
 * editor's palette and a pre-flight check that mirrors
 * `400 TEMPLATE_UNKNOWN_VARIABLE`, so an admin learns about a typo before
 * publishing. Values are substituted (and money formatted `USD 123.45`) on
 * the server; the client never renders them.
 */

export const CONTRACT_KIND_LABELS: Record<ContractKind, string> = {
  host_agreement: "Host agreement",
  rental_agreement: "Rental agreement",
};

export function contractKindLabel(kind: string): string {
  const labels: Record<string, string | undefined> = CONTRACT_KIND_LABELS;
  return labels[kind] ?? kind;
}

export const CONTRACT_TEMPLATE_STATUS_LABELS: Record<
  ContractTemplateStatus,
  string
> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

/** Bounds mirrored from the backend DTOs (spec §4/B7). */
export const TEMPLATE_BODY_MAX = 60_000;
/** Title/change-note bounds are not spelled out by the spec — sane UI caps. */
export const TEMPLATE_TITLE_MIN = 2;
export const TEMPLATE_TITLE_MAX = 200;
export const TEMPLATE_CHANGE_NOTE_MAX = 500;

export interface ContractVariable {
  /** The `{{name}}` token, e.g. `host.legalName`. */
  name: string;
  description: string;
}

export interface ContractVariableGroup {
  label: string;
  /** Present for both kinds unless `rentalOnly`. */
  rentalOnly?: boolean;
  variables: ContractVariable[];
}

const VARIABLE_GROUPS: ContractVariableGroup[] = [
  {
    label: "Platform",
    variables: [
      { name: "platform.legalName", description: "Platform legal entity name" },
      { name: "platform.legalAddress", description: "Platform legal address" },
      { name: "platform.contactEmail", description: "Platform contact email" },
      { name: "platform.termsVersion", description: "Current terms version" },
      { name: "platform.commissionPct", description: "Commission percentage" },
      {
        name: "platform.freeCancellationHours",
        description: "Free-cancellation window (hours from acceptance)",
      },
      {
        name: "platform.lateCancellationRetentionPct",
        description: "Late-cancellation retention (% of subtotal)",
      },
      {
        name: "platform.earlyReturnPenaltyDays",
        description: "Early-return penalty (days)",
      },
      {
        name: "platform.disputeWindowHours",
        description: "Dispute window after return (hours)",
      },
      {
        name: "platform.claimResponseHours",
        description: "Customer claim-response window (hours)",
      },
    ],
  },
  {
    label: "Host",
    variables: [
      { name: "host.displayName", description: "Public host / agency name" },
      { name: "host.legalName", description: "Legal name" },
      { name: "host.kind", description: "business or individual" },
      { name: "host.idNumber", description: "Owner ID (cédula)" },
      { name: "host.taxId", description: "Tax ID (RNC)" },
      { name: "host.address", description: "Registered address" },
      { name: "host.phone", description: "Phone" },
      { name: "host.email", description: "Owner email" },
      { name: "host.rentalConditions", description: "Published rental conditions" },
      { name: "host.minDriverAge", description: "Minimum driver age" },
      { name: "host.depositNote", description: "Deposit note" },
    ],
  },
  {
    label: "Signature",
    variables: [{ name: "signature.date", description: "Signing date" }],
  },
  {
    label: "Customer",
    rentalOnly: true,
    variables: [
      { name: "customer.fullName", description: "Renter full name" },
      { name: "customer.email", description: "Renter email" },
      { name: "customer.phone", description: "Renter phone" },
      { name: "customer.licenseNumber", description: "Driver's license number" },
      { name: "customer.licenseExpiry", description: "License expiry date" },
      { name: "customer.dateOfBirth", description: "Date of birth" },
    ],
  },
  {
    label: "Car",
    rentalOnly: true,
    variables: [
      { name: "car.make", description: "Make" },
      { name: "car.model", description: "Model" },
      { name: "car.year", description: "Year" },
      { name: "car.color", description: "Color" },
      { name: "car.plate", description: "Plate" },
    ],
  },
  {
    label: "Booking",
    rentalOnly: true,
    variables: [
      { name: "booking.id", description: "Booking id" },
      { name: "booking.start", description: "Pickup date" },
      { name: "booking.end", description: "Return date" },
      { name: "booking.period", description: "Rental period (formatted)" },
      { name: "booking.days", description: "Rental days" },
      { name: "booking.pickupType", description: "Branch pickup or delivery" },
      { name: "booking.pickupAddress", description: "Pickup / delivery address" },
    ],
  },
  {
    label: "Price",
    rentalOnly: true,
    variables: [
      { name: "price.ratePerDay", description: "Rate per day" },
      { name: "price.deliveryFee", description: "Delivery fee" },
      { name: "price.subtotal", description: "Subtotal" },
      { name: "price.commission", description: "Platform commission" },
      { name: "price.total", description: "Customer total" },
      { name: "price.currency", description: "Currency code" },
    ],
  },
  {
    label: "Deposit",
    rentalOnly: true,
    variables: [
      { name: "deposit.amount", description: "Security deposit (formatted)" },
    ],
  },
];

/** The palette groups a template of `kind` may use. */
export function contractVariableGroups(
  kind: ContractKind,
): ContractVariableGroup[] {
  return kind === "rental_agreement"
    ? VARIABLE_GROUPS
    : VARIABLE_GROUPS.filter((g) => !g.rentalOnly);
}

const VARIABLE_TOKEN = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

/** Unique `{{name}}` tokens used in a Markdown body, in order of appearance. */
export function extractTemplateVariables(markdown: string): string[] {
  const seen = new Set<string>();
  for (const match of markdown.matchAll(VARIABLE_TOKEN)) {
    const name = match[1];
    if (name !== undefined) seen.add(name);
  }
  return [...seen];
}

/** Tokens the server would reject on publish (`TEMPLATE_UNKNOWN_VARIABLE`). */
export function unknownTemplateVariables(
  markdown: string,
  kind: ContractKind,
): string[] {
  const allowed = new Set(
    contractVariableGroups(kind).flatMap((g) => g.variables.map((v) => v.name)),
  );
  return extractTemplateVariables(markdown).filter((v) => !allowed.has(v));
}

/** Wraps a variable name as the `{{token}}` the renderer expects. */
export function variableToken(name: string): string {
  return `{{${name}}}`;
}
