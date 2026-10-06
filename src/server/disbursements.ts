import "server-only";
import { Types } from "mongoose";
import type { CaseCategory } from "@/lib/cases";
import { parseDateKey } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import {
  canApproveDisbursement,
  exceedsApproved,
  isFullyPaid,
  needsSecondApproval,
  PAYABLE_CASE_STATUSES,
  type ApprovalStatus,
} from "@/lib/payouts";
import { requirePermission } from "@/lib/permissions";
import { disbursementFormSchema, reasonFormSchema } from "@/lib/validators";
import { Account, AidCase, Disbursement, User, type DisbursementDoc } from "@/models";
import { assertBalanceCovers } from "./accounts";
import { logActivity } from "./activity-log";
import { payoutsByCase } from "./payout-totals";
import { readSettings } from "./settings";
import { photoViewUrl } from "./storage";

export type DisbursementItem = {
  id: string;
  amount: number;
  date: string;
  accountName: string;
  paidById: string;
  paidByName: string;
  receivedByName: string;
  /** Link to the receipt photo, valid for about an hour. */
  photoUrl: string | null;
  note: string;
  approvalStatus: ApprovalStatus;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectReason: string;
  /** The viewer may approve or reject it (pending, and they did not enter it). */
  canApprove: boolean;
};

export type PendingDisbursementItem = DisbursementItem & {
  caseId: string;
  caseNo: string;
  category: CaseCategory;
  beneficiaryName: string;
};

type Viewer = { id: string; role: "admin" | "head" | "member" };

async function toItems(rows: DisbursementDoc[], viewer: Viewer): Promise<DisbursementItem[]> {
  const userIds = [...new Set(rows.flatMap((r) => [r.paidBy, r.approvedBy]).filter(Boolean).map(String))];
  const accountIds = [...new Set(rows.map((r) => r.accountId.toString()))];
  const [users, accounts] = await Promise.all([
    userIds.length ? User.find({ _id: { $in: userIds } }).select("name").lean() : [],
    accountIds.length ? Account.find({ _id: { $in: accountIds } }).select("name").lean() : [],
  ]);
  const userName = new Map(users.map((u) => [u._id.toString(), u.name]));
  const accountName = new Map(accounts.map((a) => [a._id.toString(), a.name]));

  return Promise.all(
    rows.map(async (r) => ({
      id: r._id.toString(),
      amount: r.amount,
      date: r.date.toISOString(),
      accountName: accountName.get(r.accountId.toString()) ?? "",
      paidById: r.paidBy.toString(),
      paidByName: userName.get(r.paidBy.toString()) ?? "",
      receivedByName: r.receivedByName,
      photoUrl: await photoViewUrl(r.receiptPhotoKey),
      note: r.note,
      approvalStatus: r.approvalStatus,
      approvedByName: r.approvedBy ? (userName.get(r.approvedBy.toString()) ?? null) : null,
      approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
      rejectReason: r.rejectReason,
      canApprove: canApproveDisbursement(viewer, { paidBy: r.paidBy.toString(), approvalStatus: r.approvalStatus }),
    })),
  );
}

/** Money paid out on one case, newest first (heads and admin). */
export async function listCaseDisbursements(caseId: string): Promise<DisbursementItem[]> {
  const me = await requirePermission("cases.viewNames");
  if (!Types.ObjectId.isValid(caseId)) return [];
  const rows = await Disbursement.find({ caseId }).sort({ date: -1, createdAt: -1 }).lean<DisbursementDoc[]>();
  return toItems(rows, me);
}

/** Disbursements waiting for a second head, oldest first (dashboard). */
export async function listPendingDisbursements(): Promise<PendingDisbursementItem[]> {
  const me = await requirePermission("disbursements.approve");
  const rows = await Disbursement.find({ approvalStatus: "pending" }).sort({ createdAt: 1 }).lean<DisbursementDoc[]>();
  const items = await toItems(rows, me);
  const cases = await AidCase.find({ _id: { $in: rows.map((r) => r.caseId) } })
    .select("caseNo category beneficiaryName")
    .lean();
  const byId = new Map(cases.map((c) => [c._id.toString(), c]));
  return items.map((item, i) => {
    const c = byId.get(rows[i].caseId.toString());
    return {
      ...item,
      caseId: rows[i].caseId.toString(),
      caseNo: c?.caseNo ?? "",
      category: c?.category ?? "other",
      beneficiaryName: c?.beneficiaryName ?? "",
    };
  });
}

export type RecordedDisbursement = {
  id: string;
  approvalStatus: ApprovalStatus;
  /** Everything approved is now paid: the head may mark the case completed. */
  fullyPaid: boolean;
};

/**
 * Pays money out on an approved or in-progress case. Refused when it would go
 * over the approved amount (raise the amount with a reason first) or leave the
 * account below zero. Above the second-head limit it waits as "pending" and
 * does not touch the account until approved.
 */
export async function recordDisbursement(caseId: string, input: unknown): Promise<RecordedDisbursement> {
  const actor = await requirePermission("disbursements.record");
  const values = disbursementFormSchema.parse(input);
  if (!Types.ObjectId.isValid(caseId)) throw new AppError("notFound");
  const aidCase = await AidCase.findById(caseId).select("caseNo status approvedAmount").lean();
  if (!aidCase) throw new AppError("notFound");
  if (!(PAYABLE_CASE_STATUSES as readonly string[]).includes(aidCase.status)) throw new AppError("caseNotPayable");

  const payouts = (await payoutsByCase([aidCase._id])).get(aidCase._id.toString()) ?? { paid: 0, pending: 0 };
  const state = { approvedAmount: aidCase.approvedAmount ?? null, ...payouts };
  if (exceedsApproved(state, values.amount)) throw new AppError("exceedsApproved");

  const settings = await readSettings();
  const pending = needsSecondApproval(settings.approval, values.amount);
  // A pending payment has not left the account yet; it is checked again on approval.
  if (!pending) await assertBalanceCovers(values.accountId, values.amount);
  const account = await Account.exists({ _id: values.accountId, active: true });
  if (!account) throw new AppError("accountNotFound");

  const date = parseDateKey(values.date);
  if (!date) throw new AppError("invalidInput");
  const created = await Disbursement.create({
    caseId: aidCase._id,
    amount: values.amount,
    date,
    accountId: new Types.ObjectId(values.accountId),
    paidBy: new Types.ObjectId(actor.id),
    receivedByName: values.receivedByName,
    receiptPhotoKey: values.receiptPhotoKey,
    note: values.note,
    approvalStatus: pending ? "pending" : "not_required",
  });
  await AidCase.updateOne({ _id: aidCase._id }, { $set: { lastUpdateAt: new Date() } });

  await logActivity({
    actorId: actor.id,
    action: "disbursement.created",
    entity: "Disbursement",
    entityId: created._id,
    meta: { caseId: caseId, caseNo: aidCase.caseNo, amount: values.amount, accountId: values.accountId, approvalStatus: created.approvalStatus },
  });

  return {
    id: created._id.toString(),
    approvalStatus: created.approvalStatus,
    fullyPaid: isFullyPaid({ approvedAmount: state.approvedAmount, paid: state.paid + (pending ? 0 : values.amount) }),
  };
}

async function findPendingForDecision(disbursementId: string, actor: Viewer) {
  if (!Types.ObjectId.isValid(disbursementId)) throw new AppError("notFound");
  const d = await Disbursement.findById(disbursementId).lean();
  if (!d) throw new AppError("notFound");
  if (d.approvalStatus !== "pending") throw new AppError("alreadyDecided");
  if (!canApproveDisbursement(actor, { paidBy: d.paidBy.toString(), approvalStatus: d.approvalStatus })) {
    throw new AppError("cannotApproveOwn");
  }
  return d;
}

/** A different head (or the admin) approves a pending disbursement; only now does it leave the account. */
export async function approveDisbursement(disbursementId: string): Promise<{ fullyPaid: boolean; caseId: string }> {
  const actor = await requirePermission("disbursements.approve");
  const d = await findPendingForDecision(disbursementId, actor);
  const aidCase = await AidCase.findById(d.caseId).select("caseNo status approvedAmount").lean();
  if (!aidCase || !(PAYABLE_CASE_STATUSES as readonly string[]).includes(aidCase.status)) throw new AppError("caseNotPayable");
  await assertBalanceCovers(d.accountId.toString(), d.amount);

  const result = await Disbursement.updateOne(
    { _id: d._id, approvalStatus: "pending" },
    { $set: { approvalStatus: "approved", approvedBy: new Types.ObjectId(actor.id), approvedAt: new Date() } },
  );
  if (result.modifiedCount === 0) throw new AppError("alreadyDecided");
  await AidCase.updateOne({ _id: d.caseId }, { $set: { lastUpdateAt: new Date() } });

  await logActivity({
    actorId: actor.id,
    action: "disbursement.approved",
    entity: "Disbursement",
    entityId: d._id,
    meta: { caseId: d.caseId.toString(), caseNo: aidCase.caseNo, amount: d.amount },
  });
  const payouts = (await payoutsByCase([d.caseId])).get(d.caseId.toString()) ?? { paid: 0, pending: 0 };
  return { fullyPaid: isFullyPaid({ approvedAmount: aidCase.approvedAmount ?? null, paid: payouts.paid }), caseId: d.caseId.toString() };
}

/** A different head (or the admin) turns a pending disbursement down. It never touches the account. */
export async function rejectDisbursement(disbursementId: string, input: unknown): Promise<void> {
  const actor = await requirePermission("disbursements.approve");
  const { reason } = reasonFormSchema.parse(input);
  const d = await findPendingForDecision(disbursementId, actor);

  const result = await Disbursement.updateOne(
    { _id: d._id, approvalStatus: "pending" },
    { $set: { approvalStatus: "rejected", approvedBy: new Types.ObjectId(actor.id), approvedAt: new Date(), rejectReason: reason } },
  );
  if (result.modifiedCount === 0) throw new AppError("alreadyDecided");

  await logActivity({
    actorId: actor.id,
    action: "disbursement.rejected",
    entity: "Disbursement",
    entityId: d._id,
    meta: { caseId: d.caseId.toString(), amount: d.amount, reason },
  });
}
