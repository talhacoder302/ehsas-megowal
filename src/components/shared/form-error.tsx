"use client";

import { useTranslations } from "next-intl";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ServerErrorCode } from "@/lib/errors";

/** Shows a translated server error above a form. */
export function FormError({ code }: { code: ServerErrorCode | null }) {
  const t = useTranslations("serverErrors");
  if (!code) return null;
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertDescription>{t(code)}</AlertDescription>
    </Alert>
  );
}

/** Translates a Zod message key from the "validation" namespace. */
export function useValidationMessage() {
  const t = useTranslations("validation");
  return (message: string | undefined) =>
    message && t.has(message as Parameters<typeof t.has>[0]) ? t(message as Parameters<typeof t>[0]) : undefined;
}
