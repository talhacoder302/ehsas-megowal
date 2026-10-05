import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

type PageHeaderProps = {
  title: string;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  /** Buttons shown on the end side (wrap under the title on phones). */
  actions?: React.ReactNode;
};

/** Title row used by the manage screens. */
export function PageHeader({ title, subtitle, back, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      {back ? (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4 rtl:-scale-x-100" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
