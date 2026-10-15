import "server-only";
import { z } from "zod";

/**
 * Schemas for the PUBLIC route params — `/cars/[city]`, `/agencies/[slug]`
 * and `/agencies/[slug]/cars/[carId]`.
 *
 * These segments are raw, unauthenticated URL input: anything a crawler,
 * scanner or stray link can put in the path arrives here. Validating the
 * SHAPE before the first fetch buys two things:
 *
 *  - a correct, immediate 404 for input that cannot name a real record, with
 *    no backend round trip (a scanner walking thousands of paths costs the API
 *    nothing);
 *  - a single place that states what a public identifier looks like, instead
 *    of a regex inlined in one getter and nothing at all in the others.
 *
 * It is NOT the security boundary — every value is still
 * `encodeURIComponent`-ed into the API path, and the backend owns
 * authorization. This is input hygiene plus a cheap 404.
 */

/**
 * Kebab-case. That is exactly what the backend emits: `slugify()` strips
 * diacritics and collapses every non `[a-z0-9]` run into a single hyphen,
 * and the collision suffix it appends is base36 (backend
 * `src/modules/catalog/data/makes-models.seed.ts`). So no legitimate city,
 * region or agency slug can fail this.
 *
 * Two deliberate loosenings, each one a URL that worked before this gate:
 *  - case-INSENSITIVE, because the agency lookup already lowercases
 *    (`agencies.service.ts` → `where: { slug: slug.toLowerCase() }`):
 *    `/agencies/Cibao-Rentals` rendered the storefront with a canonical
 *    pointing at the lowercase URL, which is the correct SEO handling; a
 *    lowercase-only gate would have turned that into a dead end.
 *  - 160 characters, matching the `varchar(160)` the slug columns actually
 *    are — not a guess at the longest slug in today's data. A long agency
 *    name plus the 9-character collision suffix gets close.
 */
const slugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, "expected a kebab-case slug");

/**
 * City segment. `all` is the nationwide/region-wide pseudo-city and already
 * satisfies the slug shape, so it needs no special case.
 */
export const citySlugSchema = slugSchema;

/** Public agency storefront segment (business agencies and private hosts). */
export const agencySlugSchema = slugSchema;

/** Region filter (`?region=`), same shape as any other geo slug. */
export const regionSlugSchema = slugSchema;

/**
 * ISO-3166-1 alpha-2 country filter (`?country=`). `parseCarFilters` upper-cases
 * it before it gets here.
 */
export const countryCodeSchema = z
  .string()
  .regex(/^[A-Za-z]{2}$/, "expected a 2-letter country code");

/**
 * Car id. `z.guid()` rather than `z.uuid()`: it accepts any 8-4-4-4-12 hex
 * string, which is precisely what the Postgres `uuid` column can hold.
 * `z.uuid()` would additionally demand RFC version/variant nibbles and could
 * 404 a row that the database considers perfectly valid.
 */
export const carIdSchema = z.guid();

/**
 * True when `value` satisfies `schema`. Callers turn `false` into
 * `notFound()`. Deliberately `safeParse`: nothing here throws, so a malformed
 * param can never surface a zod issue — or the pattern it failed — to a
 * visitor or into a Sentry event.
 */
export function matchesParam(
  schema: z.ZodType<string>,
  value: string | undefined,
): boolean {
  return schema.safeParse(value).success;
}
