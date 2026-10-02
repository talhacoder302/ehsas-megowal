import { Brand } from "@/components/shared/brand";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

/** Centered single-card layout for login and password screens. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-md items-center justify-between gap-2 px-4">
        <Brand />
        <LanguageSwitcher />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16">{children}</main>
    </div>
  );
}
