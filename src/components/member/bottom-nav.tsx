"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import { FileChartColumnIcon, HandCoinsIcon, HeartHandshakeIcon, HouseIcon, UserIcon } from "lucide-react";
import type { Messages } from "@/i18n/messages";
import { cn } from "@/lib/utils";

type MemberNavItem = {
  key: keyof Messages["member"]["nav"];
  href: string;
  icon: LucideIcon;
  /** false until the module that builds this screen is done. */
  ready: boolean;
};

const items: readonly MemberNavItem[] = [
  { key: "home", href: "/member", icon: HouseIcon, ready: true },
  { key: "payments", href: "/member/payments", icon: HandCoinsIcon, ready: false },
  { key: "cases", href: "/member/cases", icon: HeartHandshakeIcon, ready: false },
  { key: "reports", href: "/member/reports", icon: FileChartColumnIcon, ready: false },
  { key: "profile", href: "/member/profile", icon: UserIcon, ready: false },
];

function isActive(pathname: string, href: string) {
  return href === "/member" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

const itemClass = "flex flex-col items-center justify-center gap-1 text-[0.7rem] font-medium leading-none";

export function BottomNav() {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("common.navigation")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {items.map(({ key, href, icon: Icon, ready }) => {
          const label = t(`member.nav.${key}`);

          if (!ready) {
            return (
              <li key={key} className="flex">
                <span aria-disabled="true" className={cn(itemClass, "flex-1 text-muted-foreground/50")}>
                  <Icon className="size-5" />
                  <span>{label}</span>
                </span>
              </li>
            );
          }

          const active = isActive(pathname, href);
          return (
            <li key={key} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(itemClass, "flex-1", active ? "text-primary" : "text-muted-foreground")}
              >
                <Icon className="size-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
