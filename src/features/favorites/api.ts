import { Api } from "@/shared/api/client";
import type { AgencyPublicProfile } from "@/features/agencies/api";

/**
 * Favourite agencies (authenticated). The `ids` list is a cheap read that
 * drives heart-toggle state across the directory / profile; `list` returns the
 * full agency cards for the favourites page.
 */
export const favoriteKeys = {
  all: ["favorites"] as const,
  list: () => ["favorites", "list"] as const,
  ids: () => ["favorites", "ids"] as const,
};

export const FavoritesApi = {
  async list(): Promise<AgencyPublicProfile[]> {
    const res = await Api.get("/favorites");
    return res.data;
  },
  async ids(): Promise<string[]> {
    const res = await Api.get("/favorites/ids");
    return res.data;
  },
  async add(agencyId: string): Promise<void> {
    await Api.post(`/favorites/${agencyId}`);
  },
  async remove(agencyId: string): Promise<void> {
    await Api.delete(`/favorites/${agencyId}`);
  },
};
