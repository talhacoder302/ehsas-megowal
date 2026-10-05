import "server-only";
import { connectDB } from "@/lib/db";
import { DEFAULT_MEMBER_NO_PREFIX, Settings } from "@/models";

export type ProgramSettings = {
  programName: string;
  villageName: string;
  memberNoPrefix: string;
  receiptPrefix: string;
};

const DEFAULTS: ProgramSettings = {
  programName: "Ehsas Program",
  villageName: "Megowal",
  memberNoPrefix: DEFAULT_MEMBER_NO_PREFIX,
  receiptPrefix: "R-",
};

/**
 * Program-wide settings with defaults filled in (older documents may miss
 * newer fields). Internal: callers must already have checked the session.
 */
export async function readSettings(): Promise<ProgramSettings> {
  await connectDB();
  const doc = await Settings.findOne({ key: "main" }).select("programName villageName memberNoPrefix receiptPrefix").lean();
  return {
    programName: doc?.programName || DEFAULTS.programName,
    villageName: doc?.villageName || DEFAULTS.villageName,
    memberNoPrefix: doc?.memberNoPrefix || DEFAULTS.memberNoPrefix,
    receiptPrefix: doc?.receiptPrefix || DEFAULTS.receiptPrefix,
  };
}
