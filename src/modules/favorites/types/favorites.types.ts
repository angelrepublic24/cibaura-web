import type { z } from "zod";
import type { favoriteIdListWireSchema } from "@/modules/favorites/schema/favorites.schema";

/**
 * Favourite types — the `z.infer` of the schemas in `../schema`. The list
 * itself is `AgencyPublicProfile[]`, which the agencies module owns.
 */
export type FavoriteIdList = z.infer<typeof favoriteIdListWireSchema>;
