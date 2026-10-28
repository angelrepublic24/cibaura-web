import { z } from "zod";
import { agencyPublicProfileWireSchema } from "@/modules/agencies/schema/agencies.schema";

/**
 * Favourite-agency wire schemas (zod v4).
 *
 * The full list reuses the AGENCIES module's storefront schema rather than
 * restating it: a favourite IS an agency card, and two copies of that shape
 * would drift the first time the storefront gains a field.
 */

/** `GET /favorites` — the full agency cards for the favourites page. */
export const favoriteAgencyListWireSchema = z.array(
  agencyPublicProfileWireSchema,
);

/** `GET /favorites/ids` — the cheap read that drives every heart toggle. */
export const favoriteIdListWireSchema = z.array(z.string());
