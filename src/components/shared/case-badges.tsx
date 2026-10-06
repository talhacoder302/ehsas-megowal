"use client";

import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import {
  Flower2Icon,
  GraduationCapIcon,
  HammerIcon,
  HandHeartIcon,
  HeartIcon,
  StethoscopeIcon,
  WheatIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CaseCategory, CaseStatus } from "@/lib/cases";
import { cn } from "@/lib/utils";

export const CATEGORY_ICONS: Record<CaseCategory, LucideIcon> = {
  wedding: HeartIcon,
  funeral: Flower2Icon,
  medical: StethoscopeIcon,
  education: GraduationCapIcon,
  house_repair: HammerIcon,
  ration: WheatIcon,
  other: HandHeartIcon,
};

const STATUS_STYLES: Record<CaseStatus, string> = {
  requested: "border-sky-500/40 text-sky-800 dark:text-sky-300",
  verifying: "border-violet-500/40 text-violet-800 dark:text-violet-300",
  approved: "border-emerald-600/40 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
  in_progress: "border-transparent bg-primary/15 text-primary",
  on_hold: "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  completed: "border-transparent bg-emerald-700 text-white",
  rejected: "border-transparent bg-muted text-muted-foreground",
};

export function CaseStatusBadge({ status, className }: { status: CaseStatus; className?: string }) {
  const t = useTranslations("caseStatus");
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status], className)}>
      {t(status)}
    </Badge>
  );
}

export function CaseCategoryLabel({ category, className }: { category: CaseCategory; className?: string }) {
  const t = useTranslations("caseCategory");
  const Icon = CATEGORY_ICONS[category];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <Icon className="size-4 shrink-0 text-primary" />
      {t(category)}
    </span>
  );
}
