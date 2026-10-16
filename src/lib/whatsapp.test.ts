import { describe, expect, it } from "vitest";
import { memberLoginMessage, receiptMessage, reminderMessage, reportMessage, romanMonthList, romanMonthLong, whatsappLink, whatsappShareLink } from "./whatsapp";

describe("whatsappLink", () => {
  it("opens a chat with the international number and encoded text", () => {
    expect(whatsappLink("03001234567", "Salam & khush raho")).toBe(
      "https://wa.me/923001234567?text=Salam%20%26%20khush%20raho",
    );
  });
});

describe("memberLoginMessage", () => {
  const text = memberLoginMessage({
    name: "Muhammad Riaz",
    programName: "Ehsas Program",
    villageName: "Megowal",
    loginUrl: "https://ehsas.example.com/login",
    mobile: "03001110003",
    password: "k7mp-q4xa",
  });

  it("has the app link, mobile and temporary password", () => {
    expect(text).toContain("https://ehsas.example.com/login");
    expect(text).toContain("0300-1110003");
    expect(text).toContain("k7mp-q4xa");
  });

  it("is written in Roman Urdu", () => {
    expect(text).toMatch(/^Assalam-o-Alaikum Muhammad Riaz,/);
    expect(text).toContain("Aarzi password");
    expect(text).toContain("Ehsas Program Megowal ki app");
  });
});

describe("receiptMessage", () => {
  it("thanks the member and links the receipt, in Roman Urdu", () => {
    const text = receiptMessage({
      name: "Muhammad Riaz",
      programName: "Ehsas Program",
      villageName: "Megowal",
      receiptNumber: "R-0007",
      amount: 2100,
      months: ["2026-09", "2026-08"],
      openingDuePaid: 1500,
      receiptUrl: "https://ehsas.example.com/receipt/abc",
    });
    expect(text).toMatch(/^Assalam-o-Alaikum Muhammad Riaz,/);
    expect(text).toContain("Raseed number: R-0007");
    expect(text).toContain("Raqam: Rs. 2,100");
    expect(text).toContain("Kis ke liye: purana baqaya Rs. 1,500, Aug 2026, Sep 2026");
    expect(text).toContain("https://ehsas.example.com/receipt/abc");
  });
});

describe("reminderMessage", () => {
  it("politely lists what is pending", () => {
    const text = reminderMessage({
      name: "Zafar Iqbal",
      programName: "Ehsas Program",
      villageName: "Megowal",
      months: ["2026-09", "2026-10"],
      openingDue: 0,
      totalDue: 800,
    });
    expect(text).toContain("Sep 2026, Oct 2026");
    expect(text).toContain("Kul raqam Rs. 800");
    expect(text).toContain("meherbani");
    expect(text).not.toContain("purana baqaya");
  });

  it("shortens a long run of months", () => {
    expect(romanMonthList(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"])).toBe(
      "Jun 2026 se Oct 2026 tak (5 mahine)",
    );
  });
});

describe("reportMessage", () => {
  const base = {
    programName: "Ehsas Program",
    villageName: "Megowal",
    month: "2026-10",
    collection: 14500,
    paidMembers: 28,
    activeMembers: 32,
    spent: 31650,
    balance: 167850,
    provisional: false,
    reportUrl: "https://ehsas.example.com/reports/2026-10",
  };

  it("gives collection, spending and balance with the report link", () => {
    const text = reportMessage(base);
    expect(text).toContain("October 2026 ki report");
    expect(text).toContain("October ki collection Rs. 14,500 (28 / 32 members), kharcha Rs. 31,650, balance Rs. 167,850.");
    expect(text).toContain("Poori report: https://ehsas.example.com/reports/2026-10");
    expect(text).not.toContain("band nahi hua");
  });

  it("warns when the month is not closed yet", () => {
    expect(reportMessage({ ...base, provisional: true })).toContain("Yeh mahina abhi band nahi hua");
  });

  it("uses full English month names and lets WhatsApp pick the chat", () => {
    expect(romanMonthLong("2026-09")).toBe("September 2026");
    expect(whatsappShareLink("Salam & report")).toBe("https://wa.me/?text=Salam%20%26%20report");
  });
});
