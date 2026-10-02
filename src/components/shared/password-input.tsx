"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type">;

/** Password field with a show/hide button. */
export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const t = useTranslations("login");
  const [visible, setVisible] = useState(false);

  return (
    // The whole field is left-to-right so the eye button stays on the padded side in Urdu too.
    <div className="relative" dir="ltr">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn("h-11 pe-11 text-base", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-lg text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  );
}
