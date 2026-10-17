"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  pageCount: number;
  total: number;
} & (
  | {
      /** Lists paged on the server: links to `basePath?…&page=n`, keeping the other search params. */
      basePath: string;
      params?: Record<string, string | undefined>;
      onPageChange?: never;
    }
  | {
      /** Lists paged in the browser. */
      onPageChange: (page: number) => void;
      basePath?: never;
      params?: never;
    }
);

/** Previous / next with "Page 2 of 5". Hidden when everything fits on one page. */
export function Pagination(props: PaginationProps) {
  const t = useTranslations("pagination");
  if (props.pageCount <= 1) return null;
  const { page, pageCount } = props;

  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(props.params ?? {})) if (value) query.set(key, value);
    if (target > 1) query.set("page", String(target));
    const text = query.toString();
    return `${props.basePath}${text ? `?${text}` : ""}`;
  };

  const control = (target: number, label: string, icon: React.ReactNode, disabled: boolean) => {
    if (disabled) {
      return (
        <Button variant="outline" size="sm" disabled aria-label={label}>
          {icon}
        </Button>
      );
    }
    if (props.onPageChange) {
      const change = props.onPageChange;
      return (
        <Button variant="outline" size="sm" aria-label={label} onClick={() => change(target)}>
          {icon}
        </Button>
      );
    }
    return (
      <Button asChild variant="outline" size="sm" aria-label={label}>
        <Link href={href(target)} scroll>
          {icon}
        </Link>
      </Button>
    );
  };

  return (
    <nav aria-label={t("label")} className="flex items-center justify-between gap-3 text-sm">
      {control(page - 1, t("previous"), <ChevronLeftIcon className="rtl:-scale-x-100" />, page <= 1)}
      <span className="text-muted-foreground">{t("pageOf", { page, count: pageCount, total: props.total })}</span>
      {control(page + 1, t("next"), <ChevronRightIcon className="rtl:-scale-x-100" />, page >= pageCount)}
    </nav>
  );
}
