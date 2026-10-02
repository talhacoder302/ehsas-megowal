"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { manageNavItems } from "./nav-items";

function isActive(pathname: string, href: string) {
  return href === "/manage" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

const itemClass = "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors";

export function ManageNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <nav aria-label={t("common.navigation")} className="flex flex-col gap-1">
      {manageNavItems.map(({ key, href, icon: Icon, ready }) => {
        const label = t(`manage.nav.${key}`);

        if (!ready) {
          return (
            <span key={key} aria-disabled="true" className={cn(itemClass, "cursor-not-allowed text-muted-foreground/70")}>
              <Icon className="size-4" />
              <span className="flex-1">{label}</span>
              <Badge variant="outline" className="text-[0.65rem]">
                {t("common.comingSoon")}
              </Badge>
            </span>
          );
        }

        const active = isActive(pathname, href);
        return (
          <Link
            key={key}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              itemClass,
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
