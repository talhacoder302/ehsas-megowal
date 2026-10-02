import { getTranslations } from "next-intl/server";
import { Brand } from "@/components/shared/brand";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { UserMenu } from "@/components/shared/user-menu";
import { ManageNav } from "@/components/manage/manage-nav";
import { MobileNav } from "@/components/manage/mobile-nav";
import { requirePageUser } from "@/server/auth/guards";

export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePageUser("/manage");
  const t = await getTranslations("manage");

  return (
    <div className="flex min-h-svh w-full">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col gap-6 overflow-y-auto border-e bg-sidebar px-3 py-4 md:flex">
        <Brand href="/manage" subtitle={t("areaName")} className="px-2" />
        <ManageNav role={me.role} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur md:px-6">
          <MobileNav role={me.role} />
          <Brand href="/manage" subtitle={t("areaName")} className="md:hidden" />
          <div className="ms-auto flex items-center gap-2">
            <LanguageSwitcher />
            <UserMenu name={me.name} role={me.role} memberId={me.memberId} area="manage" />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
