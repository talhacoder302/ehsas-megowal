"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

/** Shared body for error.tsx boundaries. */
export function ErrorState({ error, retry }: ErrorStateProps) {
  const t = useTranslations();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-10">
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>{t("errors.title")}</AlertTitle>
        <AlertDescription>{t("errors.body")}</AlertDescription>
      </Alert>
      <Button onClick={() => retry()} size="lg" className="self-start">
        {t("common.tryAgain")}
      </Button>
    </div>
  );
}
