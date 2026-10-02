"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { changeLanguageAction } from "@/app/(auth)/actions";
import { localeNames, locales, type Locale } from "@/i18n/config";
import type { ServerErrorCode } from "@/lib/errors";

/** Saves the language on the account (and the cookie) from the profile page. */
export function LanguageForm({ saved }: { saved: Locale }) {
  const t = useTranslations("account");
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<Locale>(saved);
  const [serverError, setServerError] = useState<ServerErrorCode | null>(null);

  function choose(locale: Locale) {
    if (locale === saved && locale === current) return;
    setChoice(locale);
    setServerError(null);
    startTransition(async () => {
      const result = await changeLanguageAction(locale);
      if (!result.ok) {
        setServerError(result.error);
        setChoice(saved);
        return;
      }
      router.refresh();
      toast.success(t("languageSaved"));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <FormError code={serverError} />
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t("languageTitle")}>
        {locales.map((locale) => {
          const selected = choice === locale;
          return (
            <Button
              key={locale}
              type="button"
              role="radio"
              aria-checked={selected}
              variant={selected ? "default" : "outline"}
              size="lg"
              className="h-12 text-base"
              disabled={pending}
              onClick={() => choose(locale)}
              lang={locale}
            >
              {pending && selected ? <Loader2Icon className="animate-spin" /> : selected ? <CheckIcon /> : null}
              {localeNames[locale]}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
