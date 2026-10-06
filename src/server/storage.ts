import "server-only";
import { randomBytes } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { currentMonth } from "@/lib/dates";
import { getServerEnv, type R2Config } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { requirePermission, type Permission } from "@/lib/permissions";
import { buildReceiptKey, isReceiptKey, uploadRequestSchema, type ReceiptKind } from "@/lib/uploads";

// Receipt photos live in Cloudflare R2. The browser compresses the photo and
// PUTs it straight to R2 with a short-lived pre-signed URL; the app only
// stores the object key. Everything here works without R2: uploads are then
// switched off and forms save without a photo.

const UPLOAD_URL_SECONDS = 5 * 60;
const VIEW_URL_SECONDS = 60 * 60;

let cached: { config: R2Config; client: S3Client } | null = null;

function r2(): { config: R2Config; client: S3Client } | null {
  const config = getServerEnv().r2;
  if (!config) return null;
  if (!cached || cached.config !== config) {
    cached = {
      config,
      client: new S3Client({
        region: "auto",
        endpoint: config.endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
        // Without this the SDK signs checksum headers a browser PUT does not send.
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      }),
    };
  }
  return cached;
}

/** Whether photo uploads are configured. Safe to call anywhere on the server. */
export function uploadsEnabled(): boolean {
  return getServerEnv().r2 !== null;
}

const KIND_PERMISSION: Record<ReceiptKind, Permission> = {
  disbursement: "disbursements.record",
  expense: "expenses.manage",
};

export type UploadTicket = { key: string; uploadUrl: string; contentType: string };

/**
 * A pre-signed PUT URL for one receipt photo. The content type is part of the
 * signature, so the browser must send exactly that Content-Type header.
 */
export async function createReceiptUpload(input: unknown): Promise<UploadTicket> {
  const request = uploadRequestSchema.parse(input);
  await requirePermission(KIND_PERMISSION[request.kind]);
  const storage = r2();
  if (!storage) throw new AppError("uploadsDisabled");

  const key = buildReceiptKey(request.kind, currentMonth(), randomBytes(16).toString("base64url"), request.contentType);
  const uploadUrl = await getSignedUrl(
    storage.client,
    new PutObjectCommand({ Bucket: storage.config.bucket, Key: key, ContentType: request.contentType }),
    { expiresIn: UPLOAD_URL_SECONDS },
  );
  return { key, uploadUrl, contentType: request.contentType };
}

/**
 * A link to view a stored photo: the public URL when the bucket has one,
 * otherwise a signed link valid for an hour. null when there is no photo or
 * uploads are off. Internal: callers must already have checked the session.
 */
export async function photoViewUrl(key: string | null | undefined): Promise<string | null> {
  if (!key || !isReceiptKey(key)) return null;
  const storage = r2();
  if (!storage) return null;
  if (storage.config.publicUrl) return `${storage.config.publicUrl}/${key}`;
  return getSignedUrl(storage.client, new GetObjectCommand({ Bucket: storage.config.bucket, Key: key }), {
    expiresIn: VIEW_URL_SECONDS,
  });
}
