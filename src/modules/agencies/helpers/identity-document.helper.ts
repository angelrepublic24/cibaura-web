/**
 * THE HOST'S IDENTITY DOCUMENT — the client half of the backend's
 * `identity-document.ts`, which is the authority and re-checks all of this.
 *
 * The platform accepts three documents and records WHO issued each one,
 * because validation hangs off the ISSUER and not off the type:
 *
 *  - a national id card issued by `DO` is a Dominican cédula, and keeps the
 *    strict 3-7-1 format it always had;
 *  - any other pair is a document whose format this platform does not know,
 *    so it is checked as a conservative alphanumeric string rather than
 *    waved through. "We don't require a cédula" never meant "any string".
 *
 * The pair matters, not the issuer alone: a Dominican PASSPORT is also
 * issued by `DO` and is not an 11-digit cédula.
 *
 * ── WHY THIS FILE EXISTS AT ALL ───────────────────────────────────────────
 *
 * It did not, and the application form had no idea these fields existed. The
 * API has required `idType` and `idIssuer` since individual hosts shipped,
 * so every single host application died on submit with a validation error
 * naming two fields the form never showed — on the ADDRESS step, two steps
 * away from where the answer would have gone. Nobody could become a host.
 */

/** The three documents the platform accepts (`IdDocumentType` on the wire). */
export const ID_DOCUMENT_TYPES = [
  { value: "national_id", label: "National or state ID card" },
  { value: "drivers_license", label: "Driver's license" },
  { value: "passport", label: "Passport" },
] as const;

export type IdDocumentType = (typeof ID_DOCUMENT_TYPES)[number]["value"];

export const ID_DOCUMENT_TYPE_VALUES = ID_DOCUMENT_TYPES.map(
  (t) => t.value,
) as unknown as [IdDocumentType, ...IdDocumentType[]];

/** ISO 3166-1 alpha-2 of the Dominican Republic — i.e. `countries.code`. */
export const DOMINICAN_REPUBLIC = "DO";

/** Dominican cédula: 3-7-1 digits, dashes optional (`001-1234567-8`). */
export const CEDULA_PATTERN = /^\d{3}-?\d{7}-?\d$/;

/**
 * Whether a country's national id card is issued nationally or by its
 * subdivisions. The Dominican cédula is national — one JCE, one register.
 * The United States has no federal identity card at all: every one of them
 * is a STATE id, which is why the issuer has to name the state.
 *
 * A country that is not listed accepts either shape, exactly as the server
 * does: guessing wrong for a market the platform has not opened yet would
 * reject a real host's real document.
 */
const NATIONAL_ID_ISSUED_BY: Readonly<
  Record<string, "country" | "subdivision" | undefined>
> = {
  DO: "country",
  US: "subdivision",
};

/** Does a national id card from this country name a state rather than the country? */
export function nationalIdNeedsSubdivision(countryCode: string): boolean {
  return NATIONAL_ID_ISSUED_BY[countryCode] === "subdivision";
}

/**
 * A stored issuer is ONE string (`DO`, `US-FL`); the form asks it as two
 * questions. These split it back, so a host who leaves mid-application and
 * returns finds their own answers rather than an empty picker.
 */
export function issuerCountryOf(issuer: string): string {
  return issuer.slice(0, 2);
}

export function issuerSubdivisionOf(issuer: string): string {
  return issuer.length > 2 ? issuer.slice(3) : "";
}

/** The one pair that means "Dominican cédula", and therefore strict format. */
export function isDominicanCedula(
  type: IdDocumentType,
  issuer: string,
): boolean {
  return type === "national_id" && issuer === DOMINICAN_REPUBLIC;
}

/**
 * The wire value for the issuer: a country code (`DO`) or an ISO 3166-2
 * subdivision code (`US-FL`).
 *
 * A subdivision is only ever attached when the document is one a state
 * issues. A passport is a NATIONAL document — no state issues one — so the
 * country always wins there, and the server rejects `US-FL` on a passport.
 */
export function buildIdIssuer(
  type: IdDocumentType,
  countryCode: string,
  subdivisionCode?: string,
): string {
  if (type === "passport" || !subdivisionCode) return countryCode;
  return `${countryCode}-${subdivisionCode}`;
}

/**
 * Whether a document number looks like the document it claims to be, in
 * plain terms — the message is shown to the host, so it says what to type
 * rather than quoting a pattern.
 *
 * The bounds mirror the server: a cédula is 3-7-1 digits; anything else is
 * 4..40 characters of letters, digits, spaces and dashes that must start and
 * end on a letter or digit (40 is the width of the column a signed contract
 * prints this number from, so a longer one would be printed truncated).
 */
export function idNumberProblem(
  value: string,
  type: IdDocumentType,
  issuer: string,
): string | null {
  const trimmed = value.trim();
  if (isDominicanCedula(type, issuer)) {
    return CEDULA_PATTERN.test(trimmed)
      ? null
      : "Enter your cédula, e.g. 001-1234567-8";
  }
  if (trimmed.length < 4 || trimmed.length > 40) {
    return "Enter the number exactly as the document prints it";
  }
  const isAlphanumeric = (c: string): boolean =>
    (c >= "0" && c <= "9") ||
    (c >= "a" && c <= "z") ||
    (c >= "A" && c <= "Z");
  const allowed = [...trimmed].every(
    (c) => isAlphanumeric(c) || c === " " || c === "-",
  );
  // `charAt` rather than indexing: with `noUncheckedIndexedAccess` the
  // index form is `string | undefined`, and the length check above already
  // guarantees both ends exist.
  const endsAreSolid =
    isAlphanumeric(trimmed.charAt(0)) &&
    isAlphanumeric(trimmed.charAt(trimmed.length - 1));
  return allowed && endsAreSolid
    ? null
    : "Letters, numbers, spaces and dashes only";
}

/**
 * The number as it will be STORED — and therefore as a signed contract will
 * print it.
 *
 * Dashes are pure formatting in a cédula, so they go. They are NOT dropped
 * anywhere else: a licence number like `S123-4567-8901` becomes a DIFFERENT
 * number without them, and that different number is the one that would end
 * up inside an executed rental agreement.
 */
export function normalizeIdNumber(
  value: string,
  type: IdDocumentType,
  issuer: string,
): string {
  const trimmed = value.trim();
  return isDominicanCedula(type, issuer) ? trimmed.replace(/-/g, "") : trimmed;
}

/** What to call the number on screen, so the label matches the document. */
export function idNumberLabel(type: IdDocumentType, issuer: string): string {
  if (isDominicanCedula(type, issuer)) return "Cédula";
  if (type === "passport") return "Passport number";
  if (type === "drivers_license") return "License number";
  return "ID number";
}

/** The example to show under the field, for the same reason. */
export function idNumberPlaceholder(
  type: IdDocumentType,
  issuer: string,
): string {
  return isDominicanCedula(type, issuer) ? "001-1234567-8" : "";
}
