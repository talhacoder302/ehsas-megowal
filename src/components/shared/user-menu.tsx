"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HouseIcon, LayoutDashboardIcon, LogOutIcon, UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/app/(auth)/actions";
import { isStaff, type Role } from "@/lib/roles";

type UserMenuProps = {
  name: string;
  role: Role;
  memberId: string | null;
  area: "manage" | "member";
};

function initials(name: string) {
  // Words made of letters only, so "Talha (admin)" gives "TA".
  const letters = name.match(/\p{L}+/gu) ?? [];
  return letters
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export function UserMenu({ name, role, memberId, area }: UserMenuProps) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="rounded-full" aria-label={t("account.menu")} disabled={pending}>
          <Avatar>
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-medium text-foreground">{name}</span>
          <span className="text-xs font-normal text-muted-foreground">{t(`roles.${role}`)}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/${area}/profile`}>
            <UserIcon />
            {t("account.profile")}
          </Link>
        </DropdownMenuItem>
        {area === "manage" && memberId ? (
          <DropdownMenuItem asChild>
            <Link href="/member">
              <HouseIcon />
              {t("account.myMemberAccount")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {area === "member" && isStaff(role) ? (
          <DropdownMenuItem asChild>
            <Link href="/manage">
              <LayoutDashboardIcon />
              {t("account.management")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => startTransition(() => logoutAction())}>
          <LogOutIcon className="rtl:-scale-x-100" />
          {t("account.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
