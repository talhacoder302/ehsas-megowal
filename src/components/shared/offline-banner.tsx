"use client";

import { useTranslations } from "next-intl";
import { WifiOffIcon } from "lucide-react";
import { useOnline } from "@/lib/offline";

/** Shown at the top of every signed-in screen while there is no internet. */
export function OfflineBanner() {
  const t = useTranslations("offline");
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="flex items-start gap-2 border-b border-amber-500/40 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
      <WifiOffIcon className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="font-medium">{t("bannerTitle")}</span> {t("bannerBody")}
      </span>
    </div>
  );
}
