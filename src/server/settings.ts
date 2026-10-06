import "server-only";
import { connectDB } from "@/lib/db";
import type { ApprovalSettings } from "@/lib/payouts";
import { DEFAULT_MEMBER_NO_PREFIX, Settings } from "@/models";

export type ProgramSettings = {
  programName: string;
  villageName: string;
  memberNoPrefix: string;
  receiptPrefix: string;
  caseNoPrefix: string;
  showBeneficiaryNamesDefault: boolean;
  /** Disbursements above the limit wait for a second head. */
  approval: ApprovalSettings;
};

const DEFAULTS: ProgramSettings = {
  programName: "Ehsas Program",
  villageName: "Megowal",
  memberNoPrefix: DEFAULT_MEMBER_NO_PREFIX,
  receiptPrefix: "R-",
  caseNoPrefix: "C-",
  showBeneficiaryNamesDefault: false,
  approval: { enabled: false, limit: 0 },
};

/**
 * Program-wide settings with defaults filled in (older documents may miss
 * newer fields). Internal: callers must already have checked the session.
 */
export async function readSettings(): Promise<ProgramSettings> {
  await connectDB();
  const doc = await Settings.findOne({ key: "main" }).lean();
  return {
    programName: doc?.programName || DEFAULTS.programName,
    villageName: doc?.villageName || DEFAULTS.villageName,
    memberNoPrefix: doc?.memberNoPrefix || DEFAULTS.memberNoPrefix,
    receiptPrefix: doc?.receiptPrefix || DEFAULTS.receiptPrefix,
    caseNoPrefix: doc?.caseNoPrefix || DEFAULTS.caseNoPrefix,
    showBeneficiaryNamesDefault: doc?.showBeneficiaryNamesDefault ?? DEFAULTS.showBeneficiaryNamesDefault,
    approval: {
      enabled: doc?.secondHeadApprovalEnabled ?? DEFAULTS.approval.enabled,
      limit: doc?.secondHeadApprovalLimit ?? DEFAULTS.approval.limit,
    },
  };
}
