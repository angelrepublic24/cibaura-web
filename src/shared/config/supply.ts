/**
 * The SUPPLY side of the marketplace: the two onboarding funnels that already
 * exist as routes, and the single label each surface shows for them.
 *
 * Cibaura is two-sided, but the public site is built around demand (search →
 * compare → request). Supply has exactly two doors — `/become-host` for a
 * private owner with one idle car (ADR-0009) and `/become-agency` for a
 * rent-a-car business — and they cross-link to each other. Nothing here
 * invents a route: both pages ship today and both are in `sitemap.ts`.
 *
 * They live in one place because the header, the footer "Explore" column and
 * the homepage band all point at them. A hardcoded path in three components is
 * how a funnel silently drifts to a 404 when a route is renamed.
 */

/** Private owner with a car that sits idle — the generic supply door. */
export const HOST_SIGNUP_PATH = "/become-host";

/** Rent-a-car business with a fleet and branches. */
export const AGENCY_SIGNUP_PATH = "/become-agency";

/**
 * Header + homepage-band label for the host funnel. Phrased as the owner's own
 * words ("your car"), not as platform jargon ("become a host") — the person who
 * should click has a car, not a hosting ambition. The footer column keeps its
 * longer "Rent out your car", which it has the room for.
 */
export const HOST_SIGNUP_LABEL = "List your car";
