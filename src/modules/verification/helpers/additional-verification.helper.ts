import type {
  AdditionalRequest,
  AdditionalSlot,
} from "../schema/additional-verification.schema";

export const ADDITIONAL_DOCUMENT_LABELS = {
  identity_card: "Government ID",
  passport: "Passport",
  proof_of_residence: "Proof of residence",
};
export const ADDITIONAL_STATUS_LABELS = {
  requested: "Action needed",
  submitted: "Pending review",
  correction_requested: "Correction needed",
  approved: "Approved",
  withdrawn: "Withdrawn",
};
export const ADDITIONAL_SLOT_LABELS = {
  id_front: "ID — front",
  id_back: "ID — back",
  file: "Document",
};
export function requiredAdditionalSlots(
  request: Pick<AdditionalRequest, "documentType">,
): AdditionalSlot[] {
  return request.documentType === "identity_card"
    ? ["id_front", "id_back"]
    : ["file"];
}
export function canSubmitAdditional(request: AdditionalRequest): boolean {
  return (
    ["requested", "correction_requested"].includes(request.status) &&
    requiredAdditionalSlots(request).every((slot) =>
      request.files.some(
        (file) => file.revision === request.revision && file.slot === slot,
      ),
    )
  );
}
export function canReviewAdditional(request: AdditionalRequest): boolean {
  return (
    request.status === "submitted" &&
    request.submittedRevision === request.revision &&
    requiredAdditionalSlots(request).every((slot) =>
      request.files.some(
        (file) =>
          file.revision === request.submittedRevision && file.slot === slot,
      ),
    )
  );
}
