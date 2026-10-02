import Link from "next/link";
import { HandHeartIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

type BrandProps = {
  href?: string;
  subtitle?: string;
  className?: string;
};

export async function Brand({ href = "/", subtitle, className }: BrandProps) {
  const t = await getTranslations("common");

  return (
    <Link href={href} className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <HandHeartIcon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold">{t("appTitle")}</span>
        {subtitle ? <span className="truncate text-xs text-muted-foreground">{subtitle}</span> : null}
      </span>
    </Link>
  );
}
