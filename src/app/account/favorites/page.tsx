"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Heart } from "lucide-react";
import { FavoritesApi, favoriteKeys } from "@/features/favorites/api";
import { AgencyPublicCard } from "@/features/agencies/components/agency-public-card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { buttonVariants } from "@/shared/components/ui/button";

/** /account/favorites — the agencies this user has hearted. */
export default function FavoritesPage() {
  const query = useQuery({
    queryKey: favoriteKeys.list(),
    queryFn: FavoritesApi.list,
  });

  const favorites = query.data ?? [];

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Heart className="h-5 w-5 fill-red-500 text-red-500" />
        <h2 className="text-xl font-semibold text-foreground">
          Favorite agencies
        </h2>
      </div>

      {query.isLoading ? (
        <LoadingState label="Loading favorites…" className="py-16" />
      ) : query.isError ? (
        <ErrorState
          title="Could not load favorites"
          message={(query.error as Error).message}
          onRetry={() => query.refetch()}
        />
      ) : favorites.length === 0 ? (
        <EmptyState
          title="No favorites yet"
          description="Tap the heart on any agency to save it here for quick access."
          className="py-16"
          action={
            <Link href="/agencies" className={buttonVariants({ variant: "outline" })}>
              Browse agencies
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {favorites.map((a) => (
            <AgencyPublicCard key={a.id} agency={a} />
          ))}
        </div>
      )}
    </div>
  );
}
