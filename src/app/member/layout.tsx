import { Brand } from "@/components/shared/brand";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { UserMenu } from "@/components/shared/user-menu";
import { BottomNav } from "@/components/member/bottom-nav";
import { requirePageUser } from "@/server/auth/guards";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePageUser("/member");

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between gap-2 px-4">
          <Brand href="/member" />
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher />
            <UserMenu name={me.name} role={me.role} memberId={me.memberId} area="member" />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4 pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
