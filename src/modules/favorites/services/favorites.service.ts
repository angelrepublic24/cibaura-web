import { Api } from "@/shared/api/client";
import {
  favoriteAgencyListWireSchema,
  favoriteIdListWireSchema,
} from "@/modules/favorites/schema/favorites.schema";
import type { AgencyPublicProfile } from "@/modules/agencies/types/agencies.types";

/**
 * Favourite agencies API client (authenticated) — the ONLY thing in the
 * module that talks to the backend. Hooks call these, components call hooks.
 *
 *  - GET    /favorites             -> AgencyPublicProfile[]
 *  - GET    /favorites/ids         -> string[]
 *  - POST   /favorites/:agencyId   -> 204
 *  - DELETE /favorites/:agencyId   -> 204
 *
 * `ids` is a cheap read that drives heart-toggle state across the directory
 * and the storefront; `list` returns the full cards for the favourites page.
 */
class FavoritesService {
  async list(): Promise<AgencyPublicProfile[]> {
    const res = await Api.get<unknown>("/favorites");
    return favoriteAgencyListWireSchema.parse(res.data);
  }

  async ids(): Promise<string[]> {
    const res = await Api.get<unknown>("/favorites/ids");
    return favoriteIdListWireSchema.parse(res.data);
  }

  async add(agencyId: string): Promise<void> {
    await Api.post(`/favorites/${encodeURIComponent(agencyId)}`);
  }

  async remove(agencyId: string): Promise<void> {
    await Api.delete(`/favorites/${encodeURIComponent(agencyId)}`);
  }
}

export const favoritesService = new FavoritesService();
