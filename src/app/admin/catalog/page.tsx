"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminApi, adminKeys } from "@/features/admin/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * /admin/catalog — the seeded make → model catalog agencies pick from (never
 * free text, so search facets stay clean). Read view with an add affordance;
 * models are dependent on the selected make.
 */
export default function AdminCatalogPage() {
  const qc = useQueryClient();
  const [selectedMakeId, setSelectedMakeId] = useState<string | null>(null);
  const [newMake, setNewMake] = useState("");
  const [newModel, setNewModel] = useState("");

  const makesQuery = useQuery({
    queryKey: adminKeys.makes(),
    queryFn: AdminApi.listMakes,
  });

  const modelsQuery = useQuery({
    queryKey: adminKeys.models(selectedMakeId ?? ""),
    queryFn: () => AdminApi.listModels(selectedMakeId!),
    enabled: !!selectedMakeId,
  });

  const createMake = useMutation({
    mutationFn: () => AdminApi.createMake(newMake.trim()),
    onSuccess: () => {
      setNewMake("");
      qc.invalidateQueries({ queryKey: adminKeys.makes() });
    },
  });

  const createModel = useMutation({
    mutationFn: () => AdminApi.createModel(selectedMakeId!, newModel.trim()),
    onSuccess: () => {
      setNewModel("");
      qc.invalidateQueries({ queryKey: adminKeys.models(selectedMakeId ?? "") });
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Vehicle catalog</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Makes and models agencies choose from. Adding here makes them available
        to every agency&apos;s car form and the search facets.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Makes */}
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold">Makes</h2>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newMake.trim().length >= 1) createMake.mutate();
              }}
            >
              <Input
                placeholder="Add a make (e.g. Toyota)"
                value={newMake}
                onChange={(e) => setNewMake(e.target.value)}
              />
              <Button
                type="submit"
                disabled={newMake.trim().length < 1 || createMake.isPending}
              >
                Add
              </Button>
            </form>
            {createMake.isError ? (
              <p className="mt-2 text-sm text-red-600">
                {createMake.error.message}
              </p>
            ) : null}

            <div className="mt-4">
              {makesQuery.isLoading ? (
                <LoadingState label="Loading makes…" className="py-6" />
              ) : makesQuery.isError ? (
                <ErrorState
                  title="Could not load makes"
                  message={makesQuery.error.message}
                  onRetry={() => makesQuery.refetch()}
                />
              ) : (makesQuery.data?.length ?? 0) === 0 ? (
                <EmptyState title="No makes yet" className="py-6" />
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {makesQuery.data!.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedMakeId(m.id)}
                        className={cn(
                          "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                          selectedMakeId === m.id && "bg-muted font-medium",
                        )}
                      >
                        <span>{m.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {m.slug}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Models (dependent on selected make) */}
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold">
              Models
              {selectedMakeId
                ? ""
                : " — select a make"}
            </h2>

            {selectedMakeId ? (
              <>
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newModel.trim().length >= 1) createModel.mutate();
                  }}
                >
                  <Input
                    placeholder="Add a model (e.g. Corolla)"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                  />
                  <Button
                    type="submit"
                    disabled={
                      newModel.trim().length < 1 || createModel.isPending
                    }
                  >
                    Add
                  </Button>
                </form>
                {createModel.isError ? (
                  <p className="mt-2 text-sm text-red-600">
                    {createModel.error.message}
                  </p>
                ) : null}

                <div className="mt-4">
                  {modelsQuery.isLoading ? (
                    <LoadingState label="Loading models…" className="py-6" />
                  ) : modelsQuery.isError ? (
                    <ErrorState
                      title="Could not load models"
                      message={modelsQuery.error.message}
                      onRetry={() => modelsQuery.refetch()}
                    />
                  ) : (modelsQuery.data?.length ?? 0) === 0 ? (
                    <EmptyState
                      title="No models for this make"
                      className="py-6"
                    />
                  ) : (
                    <ul className="divide-y divide-border rounded-lg border border-border">
                      {modelsQuery.data!.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between px-3 py-2 text-sm"
                        >
                          <span>{m.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {m.slug}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Pick a make on the left to see and add its models.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
