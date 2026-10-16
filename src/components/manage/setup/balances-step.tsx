"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveOpeningBalancesAction } from "@/app/manage/setup/actions";
import type { ServerErrorCode } from "@/lib/errors";
import { formatRupees, parseRupees } from "@/lib/money";
import type { SetupAccount } from "@/server/setup";

/** Step 2: what each account held at the start of the first month, from the register. */
export function BalancesStep({ accounts, locked }: { accounts: SetupAccount[]; locked: boolean }) {
  const t = useTranslations();
  const locale = useLocale() === "ur" ? "ur" : "en";
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(accounts.map((a) => [a.id, String(a.openingBalance)])));
  const [error, setError] = useState<ServerErrorCode | null>(null);
  const [saving, setSaving] = useState(false);
  const invalid = accounts.filter((a) => parseRupees(values[a.id] ?? "") === null).map((a) => a.id);
  const total = accounts.reduce((sum, a) => sum + (parseRupees(values[a.id] ?? "") ?? 0), 0);

  async function save() {
    setError(null);
    setSaving(true);
    const result = await saveOpeningBalancesAction({ accounts: accounts.map((a) => ({ accountId: a.id, openingBalance: values[a.id] ?? "" })) });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    toast.success(t("setup.balances.saved"));
    router.push("/manage/setup?step=3");
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        title={t("setup.balances.noAccounts")}
        action={
          <Button asChild>
            <Link href="/manage/accounts">
              <PlusIcon />
              {t("accounts.add")}
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <FormError code={error} />
        <ul className="flex flex-col gap-3">
          {accounts.map((a) => (
            <li key={a.id} className="flex flex-col gap-1.5">
              <label htmlFor={`opening-${a.id}`} className="flex items-baseline justify-between gap-2 text-sm font-medium">
                {a.name}
                <span className="text-xs font-normal text-muted-foreground">{t(`accountType.${a.type}`)}</span>
              </label>
              <Input
                id={`opening-${a.id}`}
                value={values[a.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [a.id]: e.target.value }))}
                inputMode="numeric"
                dir="ltr"
                disabled={locked}
                className="h-10"
                aria-invalid={invalid.includes(a.id)}
              />
              <span className="text-xs text-muted-foreground">{t("setup.balances.balanceNow", { amount: formatRupees(a.balance, locale) })}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between rounded-lg bg-primary/5 p-3">
          <span className="text-sm text-muted-foreground">{t("setup.balances.total")}</span>
          <span className="text-xl font-semibold">{formatRupees(total, locale)}</span>
        </div>
        <p className="text-xs text-muted-foreground">{t("setup.balances.hint")}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" disabled={locked || saving || invalid.length > 0} onClick={save}>
            {saving ? <Loader2Icon className="animate-spin" /> : null}
            {t("setup.balances.save")}
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/manage/accounts">
              <PlusIcon />
              {t("accounts.add")}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
