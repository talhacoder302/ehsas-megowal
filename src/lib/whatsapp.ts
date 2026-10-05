import type { MonthKey } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { formatMobile, mobileToInternational } from "@/lib/validators";

/** wa.me link that opens a chat with `mobile` (03XXXXXXXXX) and the text filled in. */
export function whatsappLink(mobile: string, text: string): string {
  return `https://wa.me/${mobileToInternational(mobile)}?text=${encodeURIComponent(text)}`;
}

export type MemberLoginMessage = {
  name: string;
  programName: string;
  villageName: string;
  /** Full login page URL. */
  loginUrl: string;
  mobile: string;
  password: string;
};

/**
 * Login details for a new member, always in Roman Urdu: most members read it
 * comfortably on any phone, whatever language the head's screen is in.
 */
export function memberLoginMessage(m: MemberLoginMessage): string {
  return [
    `Assalam-o-Alaikum ${m.name},`,
    `${m.programName} ${m.villageName} ki app par aap ka account bana diya gaya hai.`,
    "",
    `Link: ${m.loginUrl}`,
    `Mobile number: ${formatMobile(m.mobile)}`,
    `Aarzi password: ${m.password}`,
    "",
    "Pehli dafa login karne ke baad apna naya password bana lein. Yeh password kisi ko na batayein.",
    "App mein aap apna chanda, baqaya mahine aur mahana report dekh sakte hain.",
    "Shukriya",
  ].join("\n");
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Oct 2026" style month for Roman Urdu messages (fixed names, not the locale's). */
function romanMonth(month: MonthKey): string {
  const [year, mon] = month.split("-");
  return `${MONTH_NAMES[Number(mon) - 1]} ${year}`;
}

/** "Aug 2026, Sep 2026" or, for long runs, "Jun 2026 se Oct 2026 tak (5 mahine)". */
export function romanMonthList(months: readonly MonthKey[]): string {
  const sorted = [...months].sort();
  if (sorted.length <= 4) return sorted.map(romanMonth).join(", ");
  return `${romanMonth(sorted[0])} se ${romanMonth(sorted[sorted.length - 1])} tak (${sorted.length} mahine)`;
}

export type ReceiptMessage = {
  name: string;
  programName: string;
  villageName: string;
  receiptNumber: string;
  amount: number;
  months: readonly MonthKey[];
  openingDuePaid: number;
  receiptUrl: string;
};

/** Thank-you note with the receipt link, in Roman Urdu. */
export function receiptMessage(m: ReceiptMessage): string {
  const covered = [
    m.openingDuePaid > 0 ? `purana baqaya ${formatRupees(m.openingDuePaid)}` : null,
    m.months.length > 0 ? romanMonthList(m.months) : null,
  ].filter(Boolean);
  return [
    `Assalam-o-Alaikum ${m.name},`,
    `${m.programName} ${m.villageName} mein aap ka chanda wusool ho gaya hai. JazakAllah!`,
    "",
    `Raseed number: ${m.receiptNumber}`,
    `Raqam: ${formatRupees(m.amount)}`,
    covered.length > 0 ? `Kis ke liye: ${covered.join(", ")}` : null,
    "",
    `Raseed yahan dekhein: ${m.receiptUrl}`,
    "Shukriya",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export type ReminderMessage = {
  name: string;
  programName: string;
  villageName: string;
  months: readonly MonthKey[];
  openingDue: number;
  totalDue: number;
};

/** A polite reminder about pending contributions, in Roman Urdu. */
export function reminderMessage(m: ReminderMessage): string {
  // Old dues first, the same order payments are applied in.
  const parts = [
    m.openingDue > 0 ? `purana baqaya ${formatRupees(m.openingDue)}` : null,
    m.months.length > 0 ? romanMonthList(m.months) : null,
  ].filter(Boolean);
  return [
    `Assalam-o-Alaikum ${m.name},`,
    "Umeed hai aap aur ghar wale khairiyat se honge.",
    `${m.programName} ${m.villageName} ka aap ka chanda (${parts.join(", ")}) abhi baqi hai. Kul raqam ${formatRupees(m.totalDue)} banti hai.`,
    "Jab suhoolat ho, meherbani farma kar jama karwa dein taa ke gaon ke zaroorat mand gharon ki madad jaari rahe.",
    "Agar aap pehle hi jama karwa chuke hain to is paigham ko nazar andaaz kar dein.",
    "Shukriya",
  ].join("\n");
}
