"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { localeDirection } from "@/i18n/config";
import type { Role } from "@/lib/roles";
import { ManageNav } from "./manage-nav";

export function MobileNav({ role }: { role: Role }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const side = localeDirection(locale) === "rtl" ? "right" : "left";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="md:hidden" aria-label={t("openMenu")}>
          <MenuIcon className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side={side} className="w-72 bg-sidebar p-0">
        <SheetHeader className="border-b">
          <SheetTitle>{t("appTitle")}</SheetTitle>
        </SheetHeader>
        <div className="px-3">
          <ManageNav role={role} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
