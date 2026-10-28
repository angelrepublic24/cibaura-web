import type { z } from "zod";
import type {
  agencyPermissionSchema,
  agencyRequestWireSchema,
  assignableRoleSchema,
  branchScopeWireSchema,
  buildFileClaimSchema,
  carPhotoWireSchema,
  createBranchInputSchema,
  createCarInputSchema,
  createInspectionInputSchema,
  createStaffInputSchema,
  createZoneInputSchema,
  fileClaimInputSchema,
  fleetFiltersSchema,
  inspectionDetailsSchema,
  manualBlockInputSchema,
  permissionContextWireSchema,
  registerInspectionMediaInputSchema,
  requestFiltersSchema,
  signContractInputSchema,
  staffMemberWireSchema,
  staffRoleSchema,
  updateAgencySettingsInputSchema,
  updateBranchInputSchema,
  updateCarInputSchema,
  updateInspectionInputSchema,
  updateStaffInputSchema,
  walkInBookingInputSchema,
} from "@/modules/agency/schema/agency.schema";
import type { agencySessionWireSchema } from "@/modules/agency/schema/agency.schema";
import type { MediaKind, MediaLabel } from "@/shared/types/domain";

// ── RBAC ────────────────────────────────────────────────────────────────────

export type AgencyPermission = z.infer<typeof agencyPermissionSchema>;
export type StaffRole = z.infer<typeof staffRoleSchema>;
/** Bundles assignable to staff (owner is implicit, never assigned). */
export type AssignableRole = z.infer<typeof assignableRoleSchema>;
export type BranchScope = z.infer<typeof branchScopeWireSchema>;
export type BranchScopeMode = BranchScope["mode"];
export type PermissionContext = z.infer<typeof permissionContextWireSchema>;
export type AgencySession = z.infer<typeof agencySessionWireSchema>;
export type StaffMember = z.infer<typeof staffMemberWireSchema>;

// ── Wire ────────────────────────────────────────────────────────────────────

export type AgencyRequest = z.infer<typeof agencyRequestWireSchema>;
export type CarPhoto = z.infer<typeof carPhotoWireSchema>;

// ── Queries & request bodies ────────────────────────────────────────────────

export type FleetFilters = z.infer<typeof fleetFiltersSchema>;
export type RequestFilters = z.infer<typeof requestFiltersSchema>;
export type UpdateAgencySettingsInput = z.infer<
  typeof updateAgencySettingsInputSchema
>;
export type CreateStaffInput = z.infer<typeof createStaffInputSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffInputSchema>;
export type CreateCarInput = z.infer<typeof createCarInputSchema>;
export type UpdateCarInput = z.infer<typeof updateCarInputSchema>;
export type CreateBranchInput = z.infer<typeof createBranchInputSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchInputSchema>;
export type CreateZoneInput = z.infer<typeof createZoneInputSchema>;
export type ManualBlockInput = z.infer<typeof manualBlockInputSchema>;
export type SignContractInput = z.infer<typeof signContractInputSchema>;
export type CreateInspectionInput = z.infer<
  typeof createInspectionInputSchema
>;
export type UpdateInspectionInput = z.infer<
  typeof updateInspectionInputSchema
>;
export type RegisterInspectionMediaInput = z.infer<
  typeof registerInspectionMediaInputSchema
>;
export type FileClaimInput = z.infer<typeof fileClaimInputSchema>;
export type WalkInBookingInput = z.infer<typeof walkInBookingInputSchema>;

// ── Form values ─────────────────────────────────────────────────────────────

export type InspectionDetailsFormValues = z.infer<
  typeof inspectionDetailsSchema
>;
export type FileClaimFormValues = z.infer<
  ReturnType<typeof buildFileClaimSchema>
>;

// ── Uploads ─────────────────────────────────────────────────────────────────

/** Per-file state of a sequential car-photo upload. */
export interface PhotoUploadProgress {
  /** Index into the files array. */
  index: number;
  status: "uploading" | "done" | "error";
  /** 0–100 while uploading. */
  percent: number;
  error?: string;
}

/** The three steps of the direct-to-storage inspection-media pipeline. */
export type UploadStage = "registering" | "uploading" | "completing";

export interface UploadInspectionMediaInput {
  inspectionId: string;
  kind: MediaKind;
  label: MediaLabel;
  file: File;
  /** Required for videos — read with `readVideoDuration`. */
  durationSeconds?: number;
  onProgress?: (percent: number) => void;
  /** Fired when the pipeline enters each stage (for status copy). */
  onStage?: (stage: UploadStage) => void;
  signal?: AbortSignal;
}
