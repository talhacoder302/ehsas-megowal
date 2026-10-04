import { describe, expect, it } from "vitest";
import { formatMemberNo } from "./sequence";

describe("formatMemberNo", () => {
  it("pads to three digits after the prefix", () => {
    expect(formatMemberNo(1)).toBe("EP-001");
    expect(formatMemberNo(42, "EP-")).toBe("EP-042");
    expect(formatMemberNo(7, "MG/")).toBe("MG/007");
  });

  it("keeps growing past 999", () => {
    expect(formatMemberNo(1000)).toBe("EP-1000");
  });
});
