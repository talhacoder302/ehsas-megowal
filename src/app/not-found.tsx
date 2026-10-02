import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CompassIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <EmptyState
        icon={CompassIcon}
        title={t("errors.notFoundTitle")}
        description={t("errors.notFoundBody")}
        action={
          <Button asChild variant="outline" size="lg">
            <Link href="/">{t("common.backHome")}</Link>
          </Button>
        }
      />
    </main>
  );
}
