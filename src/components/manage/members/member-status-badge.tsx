"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { MemberStatus } from "@/lib/member-status";
import { cn } from "@/lib/utils";

const STYLES: Record<MemberStatus, string> = {
  active: "border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
  left: "text-muted-foreground",
  deceased: "border-transparent bg-muted text-muted-foreground",
  exempt: "border-amber-500/40 text-amber-700 dark:text-amber-400",
};

export function MemberStatusBadge({ status, className }: { status: MemberStatus; className?: string }) {
  const t = useTranslations("memberStatus");
  return (
    <Badge variant="outline" className={cn(STYLES[status], className)}>
      {t(status)}
    </Badge>
  );
}
