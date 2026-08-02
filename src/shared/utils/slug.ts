/**
 * Slugify — an EXACT mirror of the backend `slugify` (catalog seed helper)
 * so a name maps to the same URL slug on both sides.
 *
 * The public `Car.agency` embed is `{ id, name }` only (no slug on the wire),
 * but agency profile routes are `/agencies/[slug]` where slug = slugify(name).
 * We recompute it here to link a car's agency name to its storefront.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    // strip combining diacritical marks (U+0300..U+036F)
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
