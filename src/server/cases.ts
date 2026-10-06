import "server-only";
import { Types } from "mongoose";
import {
  allowedNextStatuses,
  canMoveTo,
  isOpenStatus,
  lastReason,
  redactCase,
  type CaseCategory,
  type CaseStatus,
} from "@/lib/cases";
import { dateKey, parseDateKey } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { canSeeBeneficiaryDetails, requirePermission, requireUser } from "@/lib/permissions";
import {
  approvedAmountChangeSchema,
  caseFormSchema,
  caseNoteSchema,
  caseStatusChangeSchema,
  type CaseFormValues,
} from "@/lib/validators";
import { AidCase, User, type AidCaseDoc } from "@/models";
import { logActivity } from "./activity-log";
import { payoutsByCase } from "./payout-totals";
import { nextCaseNo } from "./sequence";

export type CaseListItem = {
  id: string;
  caseNo: string;
  category: CaseCategory;
  status: CaseStatus;
  /** null when the viewer may not see who the case is for. */
  beneficiaryName: string | null;
  guardianName: string | null;
  contactMobile: string | null;
  mohalla: string | null;
  description: string | null;
  estimatedAmount: number;
  approvedAmount: number | null;
  /** Paid out so far (approved disbursements). */
  paidAmount: number;
  expectedDate: string | null;
  createdAt: string;
  lastUpdateAt: string;
  /** Latest reason written for a status change. */
  lastReason: string;
  showNameToMembers: boolean;
};

export type CaseTimelineEntry = {
  status: CaseStatus;
  reason: string;
  approvedAmount: number | null;
  changedByName: string | null;
  changedAt: string;
};

export type CaseNoteItem = { id: string; text: string; createdByName: string | null; createdAt: string };

export type CaseDetail = CaseListItem & {
  /** Disbursements waiting for a second head. */
  pendingAmount: number;
  recommendedBy: string;
  createdByName: string | null;
  /** Newest first. */
  timeline: CaseTimelineEntry[];
  /** Newest first. */
  notes: CaseNoteItem[];
  /** Statuses the case may move to now. */
  nextStatuses: CaseStatus[];
};

type LeanCase = AidCaseDoc & { createdAt?: Date };

function toListItem(c: LeanCase, canSeeDetails: boolean, paidAmount: number): CaseListItem {
  return redactCase(
    {
      id: c._id.toString(),
      caseNo: c.caseNo,
      category: c.category,
      status: c.status,
      beneficiaryName: c.beneficiaryName,
      guardianName: c.guardianName,
      contactMobile: c.contactMobile,
      mohalla: c.mohalla,
      description: c.description,
      estimatedAmount: c.estimatedAmount,
      approvedAmount: c.approvedAmount ?? null,
      paidAmount,
      expectedDate: c.expectedDate ? c.expectedDate.toISOString() : null,
      createdAt: (c.createdAt ?? c._id.getTimestamp()).toISOString(),
      lastUpdateAt: c.lastUpdateAt.toISOString(),
      lastReason: lastReason(c.statusHistory),
      showNameToMembers: c.showNameToMembers,
    },
    canSeeDetails,
  );
}

async function userNames(ids: (Types.ObjectId | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is Types.ObjectId => Boolean(id)).map(String))];
  if (unique.length === 0) return new Map();
  const users = await User.find({ _id: { $in: unique } }).select("name").lean();
  return new Map(users.map((u) => [u._id.toString(), u.name]));
}

async function findCaseOrThrow(caseId: string): Promise<LeanCase> {
  if (!Types.ObjectId.isValid(caseId)) throw new AppError("notFound");
  const found = await AidCase.findById(caseId).lean<LeanCase>();
  if (!found) throw new AppError("notFound");
  return found;
}

function caseFields(values: CaseFormValues) {
  return {
    category: values.category,
    beneficiaryName: values.beneficiaryName,
    guardianName: values.guardianName,
    mohalla: values.mohalla,
    contactMobile: values.contactMobile,
    recommendedBy: values.recommendedBy,
    description: values.description,
    estimatedAmount: values.estimatedAmount,
    expectedDate: values.expectedDate ? parseDateKey(values.expectedDate) : null,
    showNameToMembers: values.showNameToMembers,
  };
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

/** All cases, newest first, with names (heads and admin). */
export async function listCases(): Promise<CaseListItem[]> {
  const me = await requirePermission("cases.viewNames");
  const cases = await AidCase.find().select("-notes").sort({ createdAt: -1 }).lean<LeanCase[]>();
  const payouts = await payoutsByCase();
  return cases.map((c) => toListItem(c, canSeeBeneficiaryDetails(me, c), payouts.get(c._id.toString())?.paid ?? 0));
}

/** null when the id is malformed or no case has it. */
export async function getCase(caseId: string): Promise<CaseDetail | null> {
  const me = await requirePermission("cases.viewNames");
  if (!Types.ObjectId.isValid(caseId)) return null;
  const c = await AidCase.findById(caseId).lean<LeanCase>();
  if (!c) return null;

  const [names, payouts] = await Promise.all([
    userNames([c.createdBy, ...c.statusHistory.map((h) => h.changedBy), ...c.notes.map((n) => n.createdBy)]),
    payoutsByCase([c._id]),
  ]);
  const paid = payouts.get(c._id.toString()) ?? { paid: 0, pending: 0 };
  const nameOf = (id: Types.ObjectId | null | undefined) => (id ? (names.get(id.toString()) ?? null) : null);

  return {
    ...toListItem(c, canSeeBeneficiaryDetails(me, c), paid.paid),
    pendingAmount: paid.pending,
    recommendedBy: c.recommendedBy,
    createdByName: nameOf(c.createdBy),
    timeline: c.statusHistory
      .map((h) => ({
        status: h.status,
        reason: h.reason,
        approvedAmount: h.approvedAmount ?? null,
        changedByName: nameOf(h.changedBy),
        changedAt: h.changedAt.toISOString(),
      }))
      .reverse(),
    notes: c.notes
      .map((n) => ({ id: n._id.toString(), text: n.text, createdByName: nameOf(n.createdBy), createdAt: n.createdAt.toISOString() }))
      .reverse(),
    nextStatuses: allowedNextStatuses({ status: c.status, approvedAmount: c.approvedAmount ?? null, statusHistory: c.statusHistory }),
  };
}

export async function createCase(input: unknown): Promise<{ id: string; caseNo: string }> {
  const actor = await requirePermission("cases.manage");
  const values = caseFormSchema.parse(input);
  const caseNo = await nextCaseNo();
  const now = new Date();

  const created = await AidCase.create({
    ...caseFields(values),
    caseNo,
    status: "requested",
    statusHistory: [{ status: "requested", reason: "", changedBy: new Types.ObjectId(actor.id), changedAt: now }],
    lastUpdateAt: now,
    createdBy: new Types.ObjectId(actor.id),
  });

  // No names in the log: the activity feed may be shown more widely later.
  await logActivity({
    actorId: actor.id,
    action: "case.created",
    entity: "AidCase",
    entityId: created._id,
    meta: { caseNo, category: values.category, estimatedAmount: values.estimatedAmount },
  });
  return { id: created._id.toString(), caseNo };
}

export async function updateCase(caseId: string, input: unknown): Promise<void> {
  const actor = await requirePermission("cases.manage");
  const existing = await findCaseOrThrow(caseId);
  const values = caseFormSchema.parse(input);

  const prev: Record<string, unknown> = {
    category: existing.category,
    beneficiaryName: existing.beneficiaryName,
    guardianName: existing.guardianName,
    mohalla: existing.mohalla,
    contactMobile: existing.contactMobile,
    recommendedBy: existing.recommendedBy,
    description: existing.description,
    estimatedAmount: existing.estimatedAmount,
    expectedDate: existing.expectedDate ? dateKey(existing.expectedDate) : "",
    showNameToMembers: existing.showNameToMembers,
  };
  const changed = Object.keys(prev).filter((key) => prev[key] !== values[key as keyof CaseFormValues]);
  if (changed.length === 0) return;

  await AidCase.updateOne({ _id: existing._id }, { $set: caseFields(values) }, { runValidators: true });
  // Only field names are logged, never the private values themselves.
  await logActivity({ actorId: actor.id, action: "case.updated", entity: "AidCase", entityId: existing._id, meta: { fields: changed } });
}

/** Moves a case along its status flow. A reason is always required; approving needs an amount. */
export async function changeCaseStatus(caseId: string, input: unknown): Promise<void> {
  const actor = await requirePermission("cases.manage");
  const existing = await findCaseOrThrow(caseId);
  const values = caseStatusChangeSchema.parse(input);

  const state = { status: existing.status, approvedAmount: existing.approvedAmount ?? null, statusHistory: existing.statusHistory };
  if (!canMoveTo(state, values.status)) throw new AppError("caseStatusNotAllowed");

  const now = new Date();
  // Matching on the old status stops two heads changing it at the same moment.
  const result = await AidCase.updateOne(
    { _id: existing._id, status: existing.status },
    {
      $set: {
        status: values.status,
        lastUpdateAt: now,
        ...(values.approvedAmount !== null ? { approvedAmount: values.approvedAmount } : {}),
      },
      $push: {
        statusHistory: {
          status: values.status,
          reason: values.reason,
          approvedAmount: values.approvedAmount,
          changedBy: new Types.ObjectId(actor.id),
          changedAt: now,
        },
      },
    },
    { runValidators: true },
  );
  if (result.modifiedCount === 0) throw new AppError("caseChangedMeanwhile");

  await logActivity({
    actorId: actor.id,
    action: "case.status_changed",
    entity: "AidCase",
    entityId: existing._id,
    meta: { caseNo: existing.caseNo, from: existing.status, to: values.status, reason: values.reason, approvedAmount: values.approvedAmount },
  });
}

/**
 * Raises or lowers the approved amount of an approved case, with a reason.
 * It can never go below what is already paid or waiting for approval.
 * Recorded in the status history so the change shows on the timeline.
 */
export async function changeApprovedAmount(caseId: string, input: unknown): Promise<void> {
  const actor = await requirePermission("cases.manage");
  const existing = await findCaseOrThrow(caseId);
  const values = approvedAmountChangeSchema.parse(input);
  if (existing.approvedAmount === null || existing.approvedAmount === undefined || !isOpenStatus(existing.status)) {
    throw new AppError("caseNotApproved");
  }
  const payouts = (await payoutsByCase([existing._id])).get(existing._id.toString()) ?? { paid: 0, pending: 0 };
  if (values.approvedAmount < payouts.paid + payouts.pending) throw new AppError("approvedBelowPaid");

  const now = new Date();
  const result = await AidCase.updateOne(
    { _id: existing._id, status: existing.status, approvedAmount: existing.approvedAmount },
    {
      $set: { approvedAmount: values.approvedAmount, lastUpdateAt: now },
      $push: {
        statusHistory: {
          status: existing.status,
          reason: values.reason,
          approvedAmount: values.approvedAmount,
          changedBy: new Types.ObjectId(actor.id),
          changedAt: now,
        },
      },
    },
    { runValidators: true },
  );
  if (result.modifiedCount === 0) throw new AppError("caseChangedMeanwhile");

  await logActivity({
    actorId: actor.id,
    action: "case.approved_amount_changed",
    entity: "AidCase",
    entityId: existing._id,
    meta: { caseNo: existing.caseNo, from: existing.approvedAmount, to: values.approvedAmount, reason: values.reason },
  });
}

export async function addCaseNote(caseId: string, input: unknown): Promise<void> {
  const actor = await requirePermission("cases.manage");
  const existing = await findCaseOrThrow(caseId);
  const { text } = caseNoteSchema.parse(input);
  const now = new Date();

  await AidCase.updateOne(
    { _id: existing._id },
    { $push: { notes: { text, createdBy: new Types.ObjectId(actor.id), createdAt: now } }, $set: { lastUpdateAt: now } },
  );
  await logActivity({ actorId: actor.id, action: "case.note_added", entity: "AidCase", entityId: existing._id, meta: { caseNo: existing.caseNo } });
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

/**
 * Cases as members see them. Beneficiary, guardian, contact, mohalla and
 * description are removed here (not in the UI) unless the case allows names.
 */
export async function listCasesForMember(): Promise<CaseListItem[]> {
  const me = await requireUser();
  const cases = await AidCase.find().select("-notes -recommendedBy -createdBy").sort({ createdAt: -1 }).lean<LeanCase[]>();
  const payouts = await payoutsByCase();
  return cases.map((c) => toListItem(c, canSeeBeneficiaryDetails(me, c), payouts.get(c._id.toString())?.paid ?? 0));
}
