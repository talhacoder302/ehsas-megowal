import "server-only";
import path from "node:path";
import type { Style } from "@react-pdf/types";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { formatDate, formatDateNumeric, formatMonth } from "@/lib/dates";
import { formatNumber } from "@/lib/money";
import type { ReceiptView } from "@/server/payments";

// Urdu uses Noto Naskh Arabic UI. react-pdf's text engine cannot shape Nastaliq
// (it runs out of memory), and with plain Naskh or Sans Arabic it drops the
// first letter of many words; the UI variant renders correctly.
// Each label and value is its own <Text> so Urdu and Latin never mix in one run.
const URDU_FONT = "NotoNaskh";
const LATIN_FONT = "Helvetica";

let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  Font.register({
    family: URDU_FONT,
    fonts: [
      { src: path.join(dir, "NotoNaskhArabicUI-Regular.ttf") },
      { src: path.join(dir, "NotoNaskhArabicUI-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Never break words with hyphens (it splits Urdu words).
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

/** Text with no Arabic-script letters can use the Latin font. */
function isLatin(text: string): boolean {
  return !/[؀-ۿ]/.test(text);
}

const colors = { ink: "#1c1917", muted: "#6b6460", line: "#e7e2dd", brand: "#0f6b47", danger: "#b42318", soft: "#f4f1ee" };

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, color: colors.ink, fontFamily: LATIN_FONT },
  header: { borderBottomWidth: 2, borderBottomColor: colors.brand, paddingBottom: 10, marginBottom: 14, alignItems: "center", gap: 3 },
  program: { fontSize: 16, fontWeight: 700, color: colors.brand },
  subtitle: { fontSize: 11, color: colors.muted },
  receiptNo: { fontSize: 12, fontWeight: 700, marginTop: 2 },
  banner: { backgroundColor: "#fdecea", borderWidth: 1, borderColor: colors.danger, borderRadius: 4, padding: 8, marginBottom: 12, gap: 2 },
  bannerTitle: { color: colors.danger, fontWeight: 700, fontSize: 12 },
  bannerText: { color: colors.danger },
  row: { justifyContent: "space-between", alignItems: "center", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: colors.line },
  label: { color: colors.muted },
  value: { fontWeight: 700 },
  section: { marginTop: 14, marginBottom: 4, fontSize: 11, fontWeight: 700 },
  table: { borderWidth: 0.5, borderColor: colors.line, borderRadius: 4 },
  cell: { justifyContent: "space-between", alignItems: "center", paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: colors.line },
  total: { justifyContent: "space-between", alignItems: "center", marginTop: 12, padding: 10, backgroundColor: colors.soft, borderRadius: 4 },
  totalLabel: { fontSize: 12, fontWeight: 700 },
  totalValue: { fontSize: 16, fontWeight: 700 },
  struck: { textDecoration: "line-through", color: colors.muted },
  footer: { marginTop: 18, alignItems: "center", gap: 3 },
  footerText: { fontSize: 9, color: colors.muted },
});

type Labels = Awaited<ReturnType<typeof receiptLabels>>;

async function receiptLabels(locale: Locale) {
  const t = await getTranslations({ locale });
  return {
    title: t("receipt.title"),
    receiptNo: t("receipt.number"),
    date: t("receipt.date"),
    member: t("receipt.member"),
    memberNo: t("members.fields.memberNo"),
    fatherName: t("members.fields.fatherName"),
    receivedBy: t("receipt.receivedBy"),
    method: t("receipt.method"),
    forLabel: t("receipt.for"),
    total: t("receipt.total"),
    openingDue: t("payments.openingDue"),
    cancelled: t("receipt.cancelled"),
    thanks: t("receipt.thanks"),
    computer: t("receipt.computerMade"),
    rupees: t("receipt.rupees"),
    methods: {
      cash: t("paymentMethod.cash"),
      bank: t("paymentMethod.bank"),
      jazzcash: t("paymentMethod.jazzcash"),
      easypaisa: t("paymentMethod.easypaisa"),
    },
  };
}

// Type only; @react-pdf/types ships with @react-pdf/renderer.
type Styles = Style | Style[];

function styleList(style: Styles | undefined): Style[] {
  return Array.isArray(style) ? style : [style ?? {}];
}

const urduText: Style = { fontFamily: URDU_FONT };
const latinText: Style = { fontFamily: LATIN_FONT };

/** A piece of text in the font its script needs. */
function T({ children, style }: { children: string; style?: Styles }) {
  return <Text style={[isLatin(children) ? latinText : urduText, ...styleList(style)]}>{children}</Text>;
}

/** "Rs. 1,500" in English; "1,500" and "روپے" as two pieces in Urdu. */
function Money({ amount, rtl, rupees, style }: { amount: number; rtl: boolean; rupees: string; style?: Styles }) {
  if (!rtl) return <T style={style}>{`Rs. ${formatNumber(amount)}`}</T>;
  return (
    <View style={{ flexDirection: "row-reverse", gap: 3, alignItems: "center" }}>
      <T style={style}>{formatNumber(amount)}</T>
      <T style={style}>{rupees}</T>
    </View>
  );
}

function Row({ label, value, rtl }: { label: string; value: string; rtl: boolean }) {
  return (
    <View style={[styles.row, { flexDirection: rtl ? "row-reverse" : "row" }]}>
      <T style={styles.label}>{label}</T>
      <T style={styles.value}>{value}</T>
    </View>
  );
}

function ReceiptDocument({ receipt, locale, labels }: { receipt: ReceiptView; locale: Locale; labels: Labels }) {
  const rtl = locale === "ur";
  const dir = { flexDirection: rtl ? "row-reverse" : "row" } as const;
  const align = { textAlign: rtl ? "right" : "left" } as const;
  const struck = receipt.cancelled ? styles.struck : {};

  return (
    <Document title={`${labels.title} ${receipt.receiptNumber}`} author={receipt.programName} language={locale}>
      <Page size="A5" style={styles.page}>
        <View style={styles.header}>
          <T style={styles.program}>{`${receipt.programName} ${receipt.villageName}`}</T>
          <T style={styles.subtitle}>{labels.title}</T>
          <T style={styles.receiptNo}>{receipt.receiptNumber}</T>
        </View>

        {receipt.cancelled ? (
          <View style={styles.banner}>
            <T style={[styles.bannerTitle, align]}>{labels.cancelled}</T>
            {receipt.cancelReason ? <T style={[styles.bannerText, align]}>{receipt.cancelReason}</T> : null}
          </View>
        ) : null}

        <Row rtl={rtl} label={labels.receiptNo} value={receipt.receiptNumber} />
        <Row rtl={rtl} label={labels.date} value={rtl ? formatDateNumeric(receipt.date) : formatDate(receipt.date, locale)} />
        <Row rtl={rtl} label={labels.member} value={receipt.member.name} />
        <Row rtl={rtl} label={labels.memberNo} value={receipt.member.memberNo} />
        {receipt.member.fatherName ? <Row rtl={rtl} label={labels.fatherName} value={receipt.member.fatherName} /> : null}
        <Row rtl={rtl} label={labels.method} value={labels.methods[receipt.method]} />
        <Row rtl={rtl} label={labels.receivedBy} value={receipt.receivedByName || "-"} />

        <T style={[styles.section, align]}>{labels.forLabel}</T>
        <View style={styles.table}>
          {receipt.lines.map((line) => (
            <View key={line.month ?? "opening"} style={[styles.cell, dir]}>
              <T>{line.month ? formatMonth(line.month, locale) : labels.openingDue}</T>
              <Money amount={line.amount} rtl={rtl} rupees={labels.rupees} />
            </View>
          ))}
        </View>

        <View style={[styles.total, dir]}>
          <T style={[styles.totalLabel, struck]}>{labels.total}</T>
          <Money amount={receipt.amount} rtl={rtl} rupees={labels.rupees} style={[styles.totalValue, struck]} />
        </View>

        {receipt.note ? <T style={[{ marginTop: 10, color: colors.muted }, align]}>{receipt.note}</T> : null}

        <View style={styles.footer}>
          <T style={styles.footerText}>{labels.thanks}</T>
          <T style={styles.footerText}>{labels.computer}</T>
        </View>
      </Page>
    </Document>
  );
}

/** The receipt as a PDF file in English or Urdu. */
export async function renderReceiptPdf(receipt: ReceiptView, locale: Locale): Promise<Uint8Array> {
  registerFonts();
  const labels = await receiptLabels(locale);
  const buffer = await renderToBuffer(<ReceiptDocument receipt={receipt} locale={locale} labels={labels} />);
  return new Uint8Array(buffer);
}
