import { shiftMonth, type MonthKey } from "@/lib/dates";
import { isBillableMonth, type StatusTimeline } from "@/lib/member-status";
import type { Role } from "@/lib/roles";

// Contribution rules: rates, bills, payment allocation. Pure, safe to import
// on the client, the server and in tests.

export const BILL_STATUSES = ["unpaid", "partial", "paid", "waived"] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];

export const PAYMENT_METHODS = ["cash", "bank", "jazzcash", "easypaisa"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ACCOUNT_TYPES = ["cash_in_hand", "bank", "mobile_wallet"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

// Donation and zakat may be added later.
export const INCOME_SOURCES = ["member_contribution", "opening_balance", "other"] as const;
export type IncomeSource = (typeof INCOME_SOURCES)[number];

/** How many months past the current one a member may pay in advance. */
export const ADVANCE_MONTHS_LIMIT = 12;

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

export type RateLike = { amount: number; effectiveFrom: MonthKey };

/** The rate for a month is the latest rate whose effectiveFrom is on or before it. null if none applies yet. */
export function rateForMonth(rates: readonly RateLike[], month: MonthKey): number | null {
  let best: RateLike | null = null;
  for (const rate of rates) {
    if (rate.effectiveFrom <= month && (!best || rate.effectiveFrom > best.effectiveFrom)) best = rate;
  }
  return best ? best.amount : null;
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

/** Status of a bill that is not waived, from what has been paid. */
export function billStatusFor(amount: number, paidAmount: number): Exclude<BillStatus, "waived"> {
  if (paidAmount >= amount) return "paid";
  return paidAmount > 0 ? "partial" : "unpaid";
}

export type BillingMember = StatusTimeline & { id: string; joinDate: Date | string };

export type BillPlan = {
  /** Members who need a bill for the month. */
  toCreate: string[];
  /** Members who already have one (left untouched). */
  alreadyBilled: number;
  /** Members not billable that month (joined later, left, deceased, exempt). */
  notBillable: number;
};

/**
 * Which members get a bill for `month`. Members who already have a bill are
 * skipped, so planning again after the bills were made creates nothing.
 */
export function planBills(members: readonly BillingMember[], month: MonthKey, alreadyBilledIds: ReadonlySet<string>): BillPlan {
  const plan: BillPlan = { toCreate: [], alreadyBilled: 0, notBillable: 0 };
  for (const member of members) {
    if (!isBillableMonth(member, month)) plan.notBillable += 1;
    else if (alreadyBilledIds.has(member.id)) plan.alreadyBilled += 1;
    else plan.toCreate.push(member.id);
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export type PayableKind = "opening" | "due" | "advance";

export type PayableItem = {
  /** Stable key for lists: "opening" or the month. */
  key: string;
  kind: PayableKind;
  /** null for the opening due. */
  month: MonthKey | null;
  /** The existing bill, or null when paying creates it (opening due, unbilled months). */
  billId: string | null;
  /** What is still owed on this item. */
  due: number;
};

export type BillLike = { id: string; month: MonthKey; amount: number; paidAmount: number; status: BillStatus };

/**
 * Everything a member can pay, in the order money is applied: the opening
 * due from the paper register first, then unpaid bills oldest first, then
 * future months (advance). Months up to the current one are "due".
 */
export function buildPayableItems(input: {
  openingDue: number;
  bills: readonly BillLike[];
  /** Months with no bill yet, with the amount a bill would have. */
  unbilledMonths: readonly { month: MonthKey; amount: number }[];
  currentMonth: MonthKey;
}): PayableItem[] {
  const items: PayableItem[] = [];
  if (input.openingDue > 0) {
    items.push({ key: "opening", kind: "opening", month: null, billId: null, due: input.openingDue });
  }

  const billed = new Set(input.bills.map((b) => b.month));
  const months = [
    ...input.bills
      .filter((b) => b.status !== "waived" && b.amount > b.paidAmount)
      .map((b) => ({ month: b.month, billId: b.id as string | null, due: b.amount - b.paidAmount })),
    ...input.unbilledMonths
      .filter((m) => !billed.has(m.month) && m.amount > 0)
      .map((m) => ({ month: m.month, billId: null, due: m.amount })),
  ].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));

  for (const m of months) {
    items.push({
      key: m.month,
      kind: m.month <= input.currentMonth ? "due" : "advance",
      month: m.month,
      billId: m.billId,
      due: m.due,
    });
  }
  return items;
}

/**
 * Months with no bill yet that a member may pay: from the month after their
 * latest bill (or the current month if they have none) up to
 * ADVANCE_MONTHS_LIMIT months ahead, skipping months they are not billable in.
 */
export function unbilledMonthsFor(input: {
  member: StatusTimeline & { joinDate: Date | string };
  lastBilledMonth: MonthKey | null;
  rates: readonly RateLike[];
  currentMonth: MonthKey;
}): { month: MonthKey; amount: number }[] {
  const last = shiftMonth(input.currentMonth, ADVANCE_MONTHS_LIMIT);
  const out: { month: MonthKey; amount: number }[] = [];
  let month = input.lastBilledMonth ? shiftMonth(input.lastBilledMonth, 1) : input.currentMonth;
  for (; month <= last; month = shiftMonth(month, 1)) {
    const amount = rateForMonth(input.rates, month);
    if (amount !== null && isBillableMonth(input.member, month)) out.push({ month, amount });
  }
  return out;
}

export type AllocationLine = { item: PayableItem; amount: number };

/**
 * Splits a payment over the items in order. Each item is filled before the
 * next gets anything. `leftover` is money that did not fit anywhere.
 */
export function allocatePayment(items: readonly PayableItem[], amount: number): { lines: AllocationLine[]; leftover: number } {
  let left = Math.max(0, Math.floor(amount));
  const lines: AllocationLine[] = [];
  for (const item of items) {
    if (left <= 0) break;
    const part = Math.min(item.due, left);
    lines.push({ item, amount: part });
    left -= part;
  }
  return { lines, leftover: left };
}

/** Amount that pays items[0..index] in full. index -1 gives 0. */
export function amountThrough(items: readonly PayableItem[], index: number): number {
  let total = 0;
  for (let i = 0; i <= index && i < items.length; i += 1) total += items[i].due;
  return total;
}

/** Total of the items owed now (opening due and months up to the current one). */
export function totalDueNow(items: readonly PayableItem[]): number {
  return items.filter((i) => i.kind !== "advance").reduce((sum, i) => sum + i.due, 0);
}

// ---------------------------------------------------------------------------
// Receipts and cancellation
// ---------------------------------------------------------------------------

/** (12, "R-") -> "R-0012" */
export function formatReceiptNo(seq: number, prefix: string): string {
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * A payment may be cancelled by the admin, or by a head who did not receive
 * it (the "other head"), so nobody can quietly cancel their own entry.
 */
export function canCancelPayment(
  actor: { id: string; role: Role },
  income: { receivedBy: string | null; cancelled: boolean },
): boolean {
  if (income.cancelled) return false;
  if (actor.role === "admin") return true;
  return actor.role === "head" && income.receivedBy !== actor.id;
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export type LedgerInput =
  | { kind: "opening"; id: string; date: string; amount: number }
  | { kind: "bill"; id: string; date: string; month: MonthKey; amount: number; paidAmount: number; status: BillStatus; waivedReason: string }
  | {
      kind: "payment";
      id: string;
      date: string;
      createdAt: string;
      amount: number;
      receiptNumber: string;
      monthsCovered: MonthKey[];
      openingDuePaid: number;
      cancelled: boolean;
      cancelReason: string;
    };

export type LedgerRow = LedgerInput & {
  /** What this row adds to the balance (bills +, payments -, waived and cancelled 0). */
  effect: number;
  /** Balance due after this row; negative means paid in advance. */
  balance: number;
};

const LEDGER_ORDER: Record<LedgerInput["kind"], number> = { opening: 0, bill: 1, payment: 2 };

/** Sorts entries by date (opening due first, bills before payments on the same day) and adds a running balance. */
export function buildLedger(entries: readonly LedgerInput[]): LedgerRow[] {
  const sorted = [...entries].sort((a, b) => {
    if (a.kind === "opening" || b.kind === "opening") return LEDGER_ORDER[a.kind] - LEDGER_ORDER[b.kind];
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.kind !== b.kind) return LEDGER_ORDER[a.kind] - LEDGER_ORDER[b.kind];
    if (a.kind === "payment" && b.kind === "payment") return a.createdAt < b.createdAt ? -1 : 1;
    return 0;
  });
  let balance = 0;
  return sorted.map((entry) => {
    let effect = 0;
    if (entry.kind === "opening") effect = entry.amount;
    else if (entry.kind === "bill") effect = entry.status === "waived" ? 0 : entry.amount;
    else effect = entry.cancelled ? 0 : -entry.amount;
    balance += effect;
    return { ...entry, effect, balance };
  });
}
