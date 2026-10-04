import "server-only";
import * as XLSX from "xlsx";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { dateKey } from "@/lib/dates";
import type { MemberStatus } from "@/lib/member-status";
import { formatMobile } from "@/lib/validators";
import { listMembersForExport } from "./members";

export type MembersWorkbook = { filename: string; body: Uint8Array };

/** The members list as an .xlsx file, with headers in the viewer's language. Staff only (checked by listMembersForExport). */
export async function buildMembersWorkbook(status: MemberStatus | null, locale: Locale): Promise<MembersWorkbook> {
  const members = await listMembersForExport(status);
  const t = await getTranslations({ locale, namespace: "members.exportSheet" });
  const tStatus = await getTranslations({ locale, namespace: "memberStatus" });

  const header = [
    t("memberNo"),
    t("name"),
    t("fatherName"),
    t("mobile"),
    t("mohalla"),
    t("address"),
    t("joinDate"),
    t("status"),
    t("statusDate"),
    t("statusReason"),
    t("login"),
    t("notes"),
  ];
  // Dates go in as YYYY-MM-DD text so Excel never shifts them by time zone.
  const rows = members.map((m) => [
    m.memberNo,
    m.name,
    m.fatherName,
    m.mobile ? formatMobile(m.mobile) : "",
    m.mohalla,
    m.address,
    dateKey(m.joinDate),
    tStatus(m.status),
    m.statusChangedAt ? dateKey(m.statusChangedAt) : "",
    m.statusReason,
    m.hasLogin ? t("yes") : t("no"),
    m.notes,
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet["!cols"] = [10, 24, 24, 14, 22, 30, 12, 12, 12, 30, 10, 40].map((wch) => ({ wch }));
  sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) };

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, t("sheet"));
  if (locale === "ur") book.Workbook = { ...book.Workbook, Views: [{ RTL: true }] };

  const body = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const suffix = status ? `-${status}` : "";
  return { filename: `members${suffix}-${dateKey(Date.now())}.xlsx`, body: new Uint8Array(body) };
}
