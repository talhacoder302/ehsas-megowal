import type { Messages } from "@/i18n/messages";

/** Error codes are keys in the "serverErrors" namespace of the i18n messages. */
export type ServerErrorCode = keyof Messages["serverErrors"];

/** An expected error that is safe to show to the user (translated on the client). */
export class AppError extends Error {
  readonly code: ServerErrorCode;

  constructor(code: ServerErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
  }
}

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: ServerErrorCode };
