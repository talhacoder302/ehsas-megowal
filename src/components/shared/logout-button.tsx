import { getTranslations } from "next-intl/server";
import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/(auth)/actions";

type LogoutButtonProps = Pick<React.ComponentProps<typeof Button>, "variant" | "className" | "size">;

export async function LogoutButton({ variant = "outline", size = "lg", className }: LogoutButtonProps) {
  const t = await getTranslations("account");
  return (
    <form action={logoutAction} className={className}>
      <Button type="submit" variant={variant} size={size}>
        <LogOutIcon className="rtl:-scale-x-100" />
        {t("logout")}
      </Button>
    </form>
  );
}
