import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { favoritesService } from "@/modules/favorites/services/favorites.service";
import type { AgencyPublicProfile } from "@/modules/agencies/types/agencies.types";

/** Query keys for the favourites module (the only cache it owns). */
export const favoriteKeys = {
  all: ["favorites"] as const,
  list: () => ["favorites", "list"] as const,
  ids: () => ["favorites", "ids"] as const,
};

/** The full agency cards, for the favourites page. */
export function useFavoriteAgencies(enabled = true) {
  return useQuery({
    queryKey: favoriteKeys.list(),
    queryFn: () => favoritesService.list(),
    enabled,
  });
}

/**
 * Just the ids — what every heart toggle reads, one request for the whole
 * page.
 *
 * On the favourites page the full agency list is already cached and, by
 * definition, holds exactly the agencies this user has hearted. Seeding the
 * ids from it makes the hearts render filled on first paint instead of
 * flashing empty until the separate request resolves. Everywhere else the
 * list cache is empty, so the seed is a no-op and the query fetches.
 */
export function useFavoriteIds(enabled = true) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: favoriteKeys.ids(),
    queryFn: () => favoritesService.ids(),
    enabled,
    initialData: () => {
      const list = qc.getQueryData<AgencyPublicProfile[]>(favoriteKeys.list());
      return list?.map((a) => a.id);
    },
  });
}

/**
 * The heart itself: add or remove, OPTIMISTICALLY, so the icon fills the
 * instant it is pressed instead of after a round trip. The previous ids are
 * kept and restored if the write fails.
 *
 * Settling invalidates the whole subtree, not just the ids: a heart pressed
 * on the directory also changes what the favourites page must list, and
 * refreshing one would leave the other showing the previous answer.
 */
export function useToggleFavorite(agencyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (favorited: boolean) =>
      favorited
        ? favoritesService.remove(agencyId)
        : favoritesService.add(agencyId),
    onMutate: async (favorited: boolean) => {
      await qc.cancelQueries({ queryKey: favoriteKeys.ids() });
      const prev = qc.getQueryData<string[]>(favoriteKeys.ids()) ?? [];
      qc.setQueryData<string[]>(
        favoriteKeys.ids(),
        favorited ? prev.filter((id) => id !== agencyId) : [...prev, agencyId],
      );
      return { prev };
    },
    onError: (_error, _favorited, ctx) => {
      if (ctx?.prev) qc.setQueryData(favoriteKeys.ids(), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: favoriteKeys.all });
    },
  });
}
