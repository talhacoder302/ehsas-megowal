"use server";

import type { ActionResult } from "@/lib/errors";
import { runAction } from "@/server/action";
import { createReceiptUpload, type UploadTicket } from "@/server/storage";

/** A pre-signed URL for one receipt photo (used by <PhotoUpload>). */
export async function createUploadAction(input: unknown): Promise<ActionResult<UploadTicket>> {
  return runAction(() => createReceiptUpload(input));
}
