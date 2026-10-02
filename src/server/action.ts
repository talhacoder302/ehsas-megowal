import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { AppError, type ActionResult } from "@/lib/errors";

/**
 * Wraps a Server Action body: expected errors become `{ ok: false, error }`
 * with a translatable code, anything else is logged and reported as "unknown".
 * redirect() and notFound() still work inside `fn`.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AppError) return { ok: false, error: error.code };
    if (error instanceof ZodError) return { ok: false, error: "invalidInput" };
    console.error("[action]", error);
    return { ok: false, error: "unknown" };
  }
}
