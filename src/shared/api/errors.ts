import { AxiosError } from "axios";

/**
 * Stable backend error codes the web keys off (never the message). The
 * literal strings mirror `backend/src/common/errors` — see DOMAIN.md
 * "Error body". Add a code here only when a screen branches on it.
 */
export const API_ERROR_CODES = {
  QUOTE_CONFIRMATION_REQUIRED: "QUOTE_CONFIRMATION_REQUIRED",
  AGREEMENT_CONFIRMATION_REQUIRED: "AGREEMENT_CONFIRMATION_REQUIRED",
  TERMS_OUTDATED: "TERMS_OUTDATED",
  TERMS_ACCEPTANCE_REQUIRED: "TERMS_ACCEPTANCE_REQUIRED",
  CANCELLATION_WINDOW_CLOSED: "CANCELLATION_WINDOW_CLOSED",
  ACCOUNT_HAS_ACTIVE_BOOKINGS: "ACCOUNT_HAS_ACTIVE_BOOKINGS",
  ACCOUNT_OWNS_AGENCY: "ACCOUNT_OWNS_AGENCY",
  PASSWORD_INCORRECT: "PASSWORD_INCORRECT",
  USER_SUSPENDED: "USER_SUSPENDED",
  RESET_TOKEN_INVALID: "RESET_TOKEN_INVALID",
  DRIVER_TOO_YOUNG: "DRIVER_TOO_YOUNG",
  VERIFICATION_INCOMPLETE: "VERIFICATION_INCOMPLETE",
  CUSTOMER_NOT_VERIFIED: "CUSTOMER_NOT_VERIFIED",
  LICENSE_EXPIRES_BEFORE_END: "LICENSE_EXPIRES_BEFORE_END",
  RENTAL_TOO_LONG: "RENTAL_TOO_LONG",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  PAYOUT_BANK_DETAILS_MISSING: "PAYOUT_BANK_DETAILS_MISSING",
  PAYOUT_NOT_PENDING: "PAYOUT_NOT_PENDING",
  PERIOD_ALREADY_STARTED: "PERIOD_ALREADY_STARTED",
  // ── v1 expansion (spec §0.2: personas, contracts, inspections, deposits,
  //    claims, settlement, Stripe payout rail) ──
  INDIVIDUAL_SINGLE_BRANCH: "INDIVIDUAL_SINGLE_BRANCH",
  CAR_REGISTRATION_REQUIRED: "CAR_REGISTRATION_REQUIRED",
  HOST_AGREEMENT_REQUIRED: "HOST_AGREEMENT_REQUIRED",
  HOST_AGREEMENT_OUTDATED: "HOST_AGREEMENT_OUTDATED",
  OWNER_ONLY: "OWNER_ONLY",
  SIGNATURE_REQUIRED: "SIGNATURE_REQUIRED",
  TEMPLATE_NOT_PUBLISHED: "TEMPLATE_NOT_PUBLISHED",
  TEMPLATE_NOT_DRAFT: "TEMPLATE_NOT_DRAFT",
  TEMPLATE_UNKNOWN_VARIABLE: "TEMPLATE_UNKNOWN_VARIABLE",
  INSPECTION_EXISTS: "INSPECTION_EXISTS",
  INSPECTION_WRONG_STATE: "INSPECTION_WRONG_STATE",
  INSPECTION_REQUIRED: "INSPECTION_REQUIRED",
  /** The renter has not given their hand-over code yet. */
  HANDOVER_NOT_CONFIRMED: "HANDOVER_NOT_CONFIRMED",
  /** Wrong code. Costs one of five tries. */
  HANDOVER_CODE_MISMATCH: "HANDOVER_CODE_MISMATCH",
  /** Too many wrong codes; the message carries the wait. */
  HANDOVER_CODE_LOCKED: "HANDOVER_CODE_LOCKED",
  /** This booking never had a code — a walk-in, or one from before the feature. */
  HANDOVER_CODE_NOT_APPLICABLE: "HANDOVER_CODE_NOT_APPLICABLE",
  INSPECTION_INCOMPLETE: "INSPECTION_INCOMPLETE",
  MEDIA_LIMIT_EXCEEDED: "MEDIA_LIMIT_EXCEEDED",
  MEDIA_TOO_LARGE: "MEDIA_TOO_LARGE",
  MEDIA_TYPE_UNSUPPORTED: "MEDIA_TYPE_UNSUPPORTED",
  MEDIA_NOT_UPLOADED: "MEDIA_NOT_UPLOADED",
  DEPOSIT_NOT_HELD: "DEPOSIT_NOT_HELD",
  DEPOSIT_REQUIRES_ACTION: "DEPOSIT_REQUIRES_ACTION",
  DEPOSIT_NOT_CAPTURABLE: "DEPOSIT_NOT_CAPTURABLE",
  DISPUTE_WINDOW_OPEN: "DISPUTE_WINDOW_OPEN",
  DISPUTE_WINDOW_CLOSED: "DISPUTE_WINDOW_CLOSED",
  CLAIM_OPEN: "CLAIM_OPEN",
  CLAIM_EXISTS: "CLAIM_EXISTS",
  CLAIM_NOT_OPEN: "CLAIM_NOT_OPEN",
  CLAIM_AMOUNT_EXCEEDS_LIMIT: "CLAIM_AMOUNT_EXCEEDS_LIMIT",
  CLAIM_RESPONSE_WINDOW_CLOSED: "CLAIM_RESPONSE_WINDOW_CLOSED",
  PAYOUT_ACCOUNT_NOT_ACTIVE: "PAYOUT_ACCOUNT_NOT_ACTIVE",
  PAYOUT_RAIL_DISABLED: "PAYOUT_RAIL_DISABLED",
  IDENTITY_NOT_AVAILABLE: "IDENTITY_NOT_AVAILABLE",
  SETTLEMENT_ALREADY_FINALIZED: "SETTLEMENT_ALREADY_FINALIZED",
  /** The renter has nothing left to upload — the nudge would be a lie. */
  RENTER_DOCUMENTS_IN_ORDER: "RENTER_DOCUMENTS_IN_ORDER",
  /** One reminder per booking per cooldown; the message carries the instant. */
  RENTER_DOCUMENTS_REMINDER_TOO_SOON: "RENTER_DOCUMENTS_REMINDER_TOO_SOON",
  /** Nothing the renter uploads can revive a closed booking. */
  RENTER_DOCUMENTS_BOOKING_CLOSED: "RENTER_DOCUMENTS_BOOKING_CLOSED",
  // ── Moderation: reports and blocks (backend `moderation/moderation-codes.ts`) ──
  /** The reason sent does not belong to the reported object's kind. */
  REPORT_REASON_NOT_ALLOWED: "REPORT_REASON_NOT_ALLOWED",
  /** The reported object does not exist, or was never visible to the reporter. */
  REPORT_TARGET_NOT_FOUND: "REPORT_TARGET_NOT_FOUND",
  /** Reporting or blocking your own content — yourself, your agency, your fleet. */
  MODERATION_SELF_TARGET: "MODERATION_SELF_TARGET",
  /** This reporter already has an open/reviewing report on this exact object. */
  REPORT_EXISTS: "REPORT_EXISTS",
  /** The block already exists. `DELETE /blocks` has no counterpart: it is idempotent. */
  BLOCK_EXISTS: "BLOCK_EXISTS",
  /**
   * Blocking a PERSON when you are not the agency's owner (403). The UI gates
   * the action to owners, so this is the belt: the copy exists for the staff
   * member who kept a stale tab open, and points them at reporting instead.
   */
  MODERATION_BLOCK_OWNER_ONLY: "MODERATION_BLOCK_OWNER_ONLY",
  /**
   * The transition is not allowed: a decided report is final, and `open` is
   * never a destination. Also the race between two admins on one row.
   */
  REPORT_NOT_OPEN: "REPORT_NOT_OPEN",
  /** Closing a report (`actioned`/`dismissed`) without saying why. */
  REPORT_RESOLUTION_NOTE_REQUIRED: "REPORT_RESOLUTION_NOTE_REQUIRED",
  /**
   * One of the two parties blocked the other, so a NEW booking between them is
   * refused. Says nothing about WHO blocked whom — a block is private.
   */
  MODERATION_BLOCKED: "MODERATION_BLOCKED",
} as const;

export type ApiErrorCode =
  (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

interface CodedErrorBody {
  code?: unknown;
}

/**
 * Read the backend's stable `code` from a failed request, or `undefined`
 * when the error is not an axios error / carries no code.
 */
/**
 * The HTTP status of a failed request, or `undefined` when the error is not an
 * axios error (e.g. a network failure, which has no response). Lets a screen
 * tell a real server response (a 409 conflict) from "no se pudo conectar".
 */
export function getApiErrorStatus(error: unknown): number | undefined {
  if (!(error instanceof AxiosError)) return undefined;
  return error.response?.status;
}

export function getApiErrorCode(error: unknown): string | undefined {
  if (!(error instanceof AxiosError)) return undefined;
  const body = error.response?.data as CodedErrorBody | undefined;
  return typeof body?.code === "string" ? body.code : undefined;
}

/**
 * The raw error body, for the few refusals that itemise themselves instead of
 * fitting in one sentence: `ACCOUNT_OWNS_AGENCY` carries the list of
 * obligations that still bind the caller's agency, each with its own numbers.
 *
 * Returns `unknown` on purpose — the caller PARSES it (zod, in the module that
 * owns the shape). A typed return here would be a cast over a server payload.
 */
export function getApiErrorBody(error: unknown): unknown {
  return error instanceof AxiosError ? error.response?.data : undefined;
}

/** True when the failed request carries exactly this backend code. */
export function isApiErrorCode(error: unknown, code: ApiErrorCode): boolean {
  return getApiErrorCode(error) === code;
}

/** The backend message (already lifted onto `error.message` by the client). */
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
