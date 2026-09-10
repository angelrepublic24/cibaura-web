import { AxiosError } from "axios";

/**
 * Stable backend error codes the web keys off (never the message). The
 * literal strings mirror `backend/src/common/errors` — see DOMAIN.md
 * "Error body". Add a code here only when a screen branches on it.
 */
export const API_ERROR_CODES = {
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
export function getApiErrorCode(error: unknown): string | undefined {
  if (!(error instanceof AxiosError)) return undefined;
  const body = error.response?.data as CodedErrorBody | undefined;
  return typeof body?.code === "string" ? body.code : undefined;
}

/** True when the failed request carries exactly this backend code. */
export function isApiErrorCode(error: unknown, code: ApiErrorCode): boolean {
  return getApiErrorCode(error) === code;
}

/** The backend message (already lifted onto `error.message` by the client). */
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
