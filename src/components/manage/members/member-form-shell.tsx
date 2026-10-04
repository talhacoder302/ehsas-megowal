import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type MemberFormShellProps = {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

/** Page frame for the add and edit member forms. */
export function MemberFormShell({ backHref, backLabel, title, subtitle, children }: MemberFormShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 rtl:-scale-x-100" />
        {backLabel}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <Card>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
