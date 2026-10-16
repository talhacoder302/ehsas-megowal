import "server-only";
import { Document, Page, StyleSheet, View, renderToBuffer } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import type { CaseCategory, CaseStatus } from "@/lib/cases";
import { formatDate, formatDateNumeric, formatMonth } from "@/lib/dates";
import { formatNumber } from "@/lib/money";
import type { ExpenseCategory } from "@/lib/payouts";
import type { MonthlyReport } from "@/server/reports";
import { colors, LATIN_FONT, Money, registerFonts, T } from "./pdf-kit";

const styles = StyleSheet.create({
  page: { paddingVertical: 32, paddingHorizontal: 36, fontSize: 10, color: colors.ink, fontFamily: LATIN_FONT },
  header: { borderBottomWidth: 2, borderBottomColor: colors.brand, paddingBottom: 10, marginBottom: 12, alignItems: "center", gap: 3 },
  program: { fontSize: 17, fontWeight: 700, color: colors.brand },
  title: { fontSize: 13, fontWeight: 700 },
  subtitle: { fontSize: 10, color: colors.muted },
  banner: { backgroundColor: "#fff4e5", borderWidth: 1, borderColor: "#d97706", borderRadius: 4, padding: 7, marginBottom: 10 },
  bannerText: { color: "#92400e" },
  section: { marginTop: 14, marginBottom: 5, fontSize: 12, fontWeight: 700, color: colors.brand },
  hint: { fontSize: 9, color: colors.muted, marginBottom: 4 },
  row: { justifyContent: "space-between", alignItems: "center", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: colors.line, gap: 8 },
  strongRow: { backgroundColor: colors.soft, paddingHorizontal: 6, borderBottomWidth: 0 },
  label: { color: colors.muted },
  strong: { fontWeight: 700 },
  group: { marginBottom: 6 },
  groupHead: { justifyContent: "space-between", alignItems: "center", paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: colors.line },
  caseRow: { justifyContent: "space-between", alignItems: "center", paddingVertical: 2, paddingHorizontal: 8, gap: 8 },
  caseBlock: { paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: colors.line, gap: 2 },
  inline: { gap: 6, alignItems: "center" },
  empty: { color: colors.muted },
  footer: { marginTop: 18, alignItems: "center", gap: 2 },
  footerText: { fontSize: 8, color: colors.muted },
});

async function reportLabels(locale: Locale) {
  const t = await getTranslations({ locale });
  const caseCategory = (c: CaseCategory) => t(`caseCategory.${c}`);
  const caseStatus = (s: CaseStatus) => t(`caseStatus.${s}`);
  const expenseCategory = (c: ExpenseCategory) => t(`expenseCategory.${c}`);
  return {
    t: (key: Parameters<typeof t>[0], values?: Record<string, string | number>) => t(key, values),
    caseCategory,
    caseStatus,
    expenseCategory,
    rupees: t("receipt.rupees"),
  };
}

type Labels = Awaited<ReturnType<typeof reportLabels>>;

/** One label/amount line; `rtl` puts the label on the right. */
function Line({ label, amount, rtl, rupees, strong }: { label: string; amount: number; rtl: boolean; rupees: string; strong?: boolean }) {
  return (
    <View style={[styles.row, strong ? styles.strongRow : {}, { flexDirection: rtl ? "row-reverse" : "row" }]}>
      <T style={strong ? styles.strong : styles.label}>{label}</T>
      <Money amount={amount} rtl={rtl} rupees={rupees} style={strong ? styles.strong : undefined} />
    </View>
  );
}

function ReportDocument({ report, locale, labels }: { report: MonthlyReport; locale: Locale; labels: Labels }) {
  const rtl = locale === "ur";
  const dir = { flexDirection: rtl ? "row-reverse" : "row" } as const;
  const align = { textAlign: rtl ? "right" : "left" } as const;
  const { t, rupees } = labels;
  const f = report.figures;
  const month = formatMonth(report.month, locale);
  const date = (iso: string) => (rtl ? formatDateNumeric(iso) : formatDate(iso, locale));

  return (
    <Document title={`${t("reports.pdfTitle")} ${report.month}`} author={report.programName} language={locale}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <T style={styles.program}>{`${report.programName} ${report.villageName}`}</T>
          <T style={styles.title}>{t("reports.pdfTitle")}</T>
          <T style={styles.title}>{month}</T>
          <T style={styles.subtitle}>{report.version === "heads" ? t("reports.headsVersion") : t("reports.membersVersion")}</T>
        </View>

        {report.closed ? null : (
          <View style={styles.banner}>
            <T style={[styles.bannerText, align]}>{t("reports.provisional")}</T>
          </View>
        )}

        <T style={[styles.section, align]}>{t("reports.summaryTitle")}</T>
        <Line rtl={rtl} rupees={rupees} label={t("reports.opening")} amount={f.openingBalance} />
        <Line rtl={rtl} rupees={rupees} label={`+ ${t("reports.collection")}`} amount={f.totalIncome} />
        <Line rtl={rtl} rupees={rupees} label={`- ${t("reports.aidGiven")}`} amount={f.totalDisbursed} />
        <Line rtl={rtl} rupees={rupees} label={`- ${t("reports.expenses")}`} amount={f.totalExpenses} />
        <Line rtl={rtl} rupees={rupees} label={t("reports.closing")} amount={f.closingBalance} strong />
        <Line rtl={rtl} rupees={rupees} label={`- ${t("reports.committed")}`} amount={f.committedAmount} />
        <Line rtl={rtl} rupees={rupees} label={`- ${t("reports.reserve")}`} amount={f.emergencyReserve} />
        <Line rtl={rtl} rupees={rupees} label={t("reports.free")} amount={f.freeBalance} strong />

        <T style={[styles.section, align]}>{t("reports.collectionTitle")}</T>
        <View style={[styles.row, dir]}>
          <T>{t("reports.membersPaid", { paid: report.collection.paidMembers, total: report.collection.activeMembers })}</T>
          <Money amount={report.collection.amount} rtl={rtl} rupees={rupees} style={styles.strong} />
        </View>
        <T style={[styles.hint, align, { marginTop: 3 }]}>{t("reports.payments", { count: report.collection.payments })}</T>

        <T style={[styles.section, align]}>{t("reports.aidTitle")}</T>
        {report.aid.groups.length === 0 ? <T style={[styles.empty, align]}>{t("reports.noAid")}</T> : null}
        {report.aid.groups.map((g) => (
          <View key={g.category} style={styles.group} wrap={false}>
            <View style={[styles.groupHead, dir]}>
              <T style={styles.strong}>{labels.caseCategory(g.category)}</T>
              <Money amount={g.total} rtl={rtl} rupees={rupees} style={styles.strong} />
            </View>
            {g.cases.map((c) => (
              <View key={c.caseNo} style={[styles.caseRow, dir]}>
                <View style={[styles.inline, dir]}>
                  <T>{c.caseNo}</T>
                  <T style={styles.label}>{c.beneficiaryName ?? t("reports.nameHidden")}</T>
                </View>
                <Money amount={c.amount} rtl={rtl} rupees={rupees} />
              </View>
            ))}
          </View>
        ))}

        <T style={[styles.section, align]}>{t("reports.expensesTitle")}</T>
        {report.expenses.groups.length === 0 ? <T style={[styles.empty, align]}>{t("reports.noExpenses")}</T> : null}
        {report.expenses.groups.map((g) => (
          <View key={g.category} style={[styles.row, dir]}>
            <T>{labels.expenseCategory(g.category)}</T>
            <Money amount={g.total} rtl={rtl} rupees={rupees} />
          </View>
        ))}

        <T style={[styles.section, align]}>{t("reports.openCasesTitle")}</T>
        <T style={[styles.hint, align]}>{t("reports.openCasesHint")}</T>
        {report.openCases.length === 0 ? <T style={[styles.empty, align]}>{t("reports.noOpenCases")}</T> : null}
        {report.openCases.map((c) => (
          <View key={c.caseNo} style={styles.caseBlock} wrap={false}>
            <View style={[styles.inline, dir, { justifyContent: "space-between" }]}>
              <View style={[styles.inline, dir]}>
                <T style={styles.strong}>{c.caseNo}</T>
                <T>{labels.caseCategory(c.category)}</T>
                {c.beneficiaryName ? <T style={styles.label}>{c.beneficiaryName}</T> : null}
              </View>
              <T style={styles.strong}>{labels.caseStatus(c.status)}</T>
            </View>
            <T style={[styles.label, align]}>
              {c.approvedAmount === null
                ? t("reports.notApproved")
                : t("reports.approvedPaid", { approved: formatNumber(c.approvedAmount), paid: formatNumber(c.paidAmount) })}
            </T>
            {c.lastReason ? <T style={align}>{c.lastReason}</T> : null}
          </View>
        ))}

        <View style={styles.footer}>
          {report.closedAt ? <T style={styles.footerText}>{t("reports.closedOn", { date: date(report.closedAt) })}</T> : null}
          <T style={styles.footerText}>{t("reports.pdfGenerated", { date: date(report.generatedAt) })}</T>
          <T style={styles.footerText}>{t("reports.pdfComputerMade")}</T>
        </View>
      </Page>
    </Document>
  );
}

/** The monthly report as a PDF in English or Urdu. The version is already applied to `report`. */
export async function renderReportPdf(report: MonthlyReport, locale: Locale): Promise<Uint8Array> {
  registerFonts();
  const labels = await reportLabels(locale);
  const buffer = await renderToBuffer(<ReportDocument report={report} locale={locale} labels={labels} />);
  return new Uint8Array(buffer);
}
