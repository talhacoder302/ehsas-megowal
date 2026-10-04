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
