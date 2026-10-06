import { beforeEach, describe, expect, it, vi } from "vitest";
import type { R2Config } from "@/lib/env";
import type { CurrentUser } from "@/server/auth/current-user";

const env: { r2: R2Config | null } = { r2: null };
vi.mock("@/lib/env", () => ({ getServerEnv: () => env }));

const getCurrentUser = vi.fn<() => Promise<CurrentUser | null>>();
vi.mock("@/server/auth/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));

const { createReceiptUpload, photoViewUrl, uploadsEnabled } = await import("./storage");

const head: CurrentUser = {
  id: "64a000000000000000000001",
  name: "Head",
  mobile: "03001110001",
  role: "head",
  memberId: null,
  language: "en",
  mustChangePassword: false,
};

const r2: R2Config = {
  accountId: "acc123",
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "secret",
  bucket: "ehsas-receipts",
  publicUrl: undefined,
  endpoint: "https://acc123.r2.cloudflarestorage.com",
};

beforeEach(() => {
  env.r2 = r2;
  getCurrentUser.mockResolvedValue(head);
});

describe("createReceiptUpload", () => {
  it("returns a key and a pre-signed PUT URL for the bucket", async () => {
    const ticket = await createReceiptUpload({ kind: "disbursement", contentType: "image/jpeg", size: 150_000 });
    expect(ticket.key).toMatch(/^receipts\/disbursement\/\d{4}\/\d{2}\/[A-Za-z0-9_-]{22}\.jpg$/);
    const url = new URL(ticket.uploadUrl);
    expect(url.host).toBe("acc123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe(`/ehsas-receipts/${ticket.key}`);
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    // No checksum headers that a browser PUT would not send.
    expect(ticket.uploadUrl.toLowerCase()).not.toContain("checksum");
    expect(ticket.contentType).toBe("image/jpeg");
  });

  it("is refused when R2 is not configured", async () => {
    env.r2 = null;
    expect(uploadsEnabled()).toBe(false);
    await expect(createReceiptUpload({ kind: "expense", contentType: "image/jpeg", size: 1000 })).rejects.toMatchObject({
      code: "uploadsDisabled",
    });
  });

  it("is only for heads and the admin", async () => {
    getCurrentUser.mockResolvedValue({ ...head, role: "member" });
    await expect(createReceiptUpload({ kind: "expense", contentType: "image/jpeg", size: 1000 })).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});

describe("photoViewUrl", () => {
  const key = "receipts/expense/2026/10/AbCdEfGhIjKlMnOpQrStUv.jpg";

  it("uses the public URL when the bucket has one", async () => {
    env.r2 = { ...r2, publicUrl: "https://photos.example.com" };
    expect(await photoViewUrl(key)).toBe(`https://photos.example.com/${key}`);
  });

  it("signs a temporary link otherwise", async () => {
    const url = new URL((await photoViewUrl(key)) ?? "");
    expect(url.pathname).toBe(`/ehsas-receipts/${key}`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
  });

  it("gives nothing for missing or foreign keys", async () => {
    expect(await photoViewUrl(null)).toBeNull();
    expect(await photoViewUrl("../../etc/passwd")).toBeNull();
  });
});
