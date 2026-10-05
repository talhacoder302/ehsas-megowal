import "server-only";
import { Types } from "mongoose";
import { currentMonth, type MonthKey } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { rateFormSchema } from "@/lib/validators";
import { ContributionRate, User } from "@/models";
import { logActivity } from "./activity-log";

export type RateItem = {
  id: string;
  amount: number;
  effectiveFrom: MonthKey;
  note: string;
  createdByName: string | null;
  createdAt: string;
  /** The rate that applies to the current month. */
  isCurrent: boolean;
};

/** Rate history, newest first. Admin only (Settings). */
export async function listRates(): Promise<RateItem[]> {
  await requirePermission("settings.manage");
  const rows = await ContributionRate.find().sort({ effectiveFrom: -1 }).lean();
  const creators = rows.map((r) => r.createdBy).filter((id): id is Types.ObjectId => Boolean(id));
  const users = creators.length ? await User.find({ _id: { $in: creators } }).select("name").lean() : [];
  const names = new Map(users.map((u) => [u._id.toString(), u.name]));

  // Rows are newest first, so the first one that has started is the current rate.
  const currentFrom = rows.find((r) => r.effectiveFrom <= currentMonth())?.effectiveFrom;

  return rows.map((r) => ({
    id: r._id.toString(),
    amount: r.amount,
    effectiveFrom: r.effectiveFrom,
    note: r.note,
    createdByName: r.createdBy ? (names.get(r.createdBy.toString()) ?? null) : null,
    createdAt: (r.createdAt ?? r._id.getTimestamp()).toISOString(),
    isCurrent: r.effectiveFrom === currentFrom,
  }));
}

/**
 * Adds a rate from a month onwards. Bills already made keep their amount;
 * only bills made after this (by generation or advance payment) use it.
 */
export async function addRate(input: unknown): Promise<RateItem["id"]> {
  const actor = await requirePermission("settings.manage");
  const values = rateFormSchema.parse(input);
  if (await ContributionRate.exists({ effectiveFrom: values.effectiveFrom })) throw new AppError("rateExists");

  const rate = await ContributionRate.create({
    amount: values.amount,
    effectiveFrom: values.effectiveFrom,
    note: values.note,
    createdBy: new Types.ObjectId(actor.id),
  }).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === 11000) throw new AppError("rateExists");
    throw error;
  });

  await logActivity({
    actorId: actor.id,
    action: "rate.created",
    entity: "ContributionRate",
    entityId: rate._id,
    meta: { amount: values.amount, effectiveFrom: values.effectiveFrom },
  });
  return rate._id.toString();
}
