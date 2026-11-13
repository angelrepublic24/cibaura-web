import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { additionalVerificationService as service } from "../services/additional-verification.service";
import type {
  AdditionalSlot,
  CreateAdditionalRequest,
  ReviewAdditionalRequest,
} from "../schema/additional-verification.schema";

const key = ["verification", "additional-requests"] as const;
export function useAdditionalRequests(customerId?: string) {
  return useQuery({
    queryKey: [...key, customerId ?? "me"],
    queryFn: () => service.list(customerId),
  });
}
export function useAdditionalAction() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  return useMutation({
    mutationFn: (
      input:
        | {
            action: "create";
            customerId: string;
            body: CreateAdditionalRequest;
          }
        | {
            action: "upload";
            id: string;
            revision: number;
            slot: AdditionalSlot;
            file: File;
          }
        | { action: "submit"; id: string; revision: number }
        | { action: "review"; id: string; body: ReviewAdditionalRequest }
        | { action: "withdraw"; id: string; revision: number; reason: string },
    ) => {
      switch (input.action) {
        case "create":
          return service.create(input.customerId, input.body);
        case "upload":
          return service.upload(
            input.id,
            input.revision,
            input.slot,
            input.file,
          );
        case "submit":
          return service.submit(input.id, input.revision);
        case "review":
          return service.review(input.id, input.body);
        case "withdraw":
          return service.withdraw(input.id, input.revision, input.reason);
      }
    },
    onSuccess: refresh,
    onError: refresh,
  });
}
