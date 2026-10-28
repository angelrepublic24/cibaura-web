"use client";

import { Heart } from "lucide-react";
import {
  useFavoriteIds,
  useToggleFavorite,
} from "@/modules/favorites/hooks/favorites.hook";
import { useAuthStore } from "@/shared/auth/store";
import { cn } from "@/lib/utils";

/**
 * Heart toggle for favouriting an agency. Renders nothing for guests. Reads the
 * shared favourite-ids query (one request for the whole page) and flips it with
 * an optimistic write so the heart fills instantly. Safe to place over a Link:
 * it stops the click from navigating.
 */
export function FavoriteButton({
  agencyId,
  className,
  size = 4,
}: {
  agencyId: string;
  className?: string;
  size?: number;
}) {
  const status = useAuthStore((s) => s.status);
  const authed = status === "authenticated";

  const idsQuery = useFavoriteIds(authed);
  const favorited = idsQuery.data?.includes(agencyId) ?? false;
  const mutation = useToggleFavorite(agencyId);

  if (!authed) return null;

  return (
    <button
      type="button"
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      title={favorited ? "Remove from favorites" : "Add to favorites"}
      disabled={mutation.isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        mutation.mutate(favorited);
      }}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/90 shadow-sm backdrop-blur transition-colors hover:bg-muted disabled:opacity-50",
        className,
      )}
    >
      <Heart
        style={{ width: `${size * 0.25}rem`, height: `${size * 0.25}rem` }}
        className={cn(
          "transition-colors",
          favorited ? "fill-red-500 text-red-500" : "text-muted-foreground",
        )}
      />
    </button>
  );
}
