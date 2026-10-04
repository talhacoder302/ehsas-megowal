import { describe, expect, it } from "vitest";
import { memberLoginMessage, whatsappLink } from "./whatsapp";

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
