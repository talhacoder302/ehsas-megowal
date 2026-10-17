"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { DownloadIcon, ShareIcon, SquarePlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Chrome's install prompt (not in the TypeScript DOM types). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallState = { prompt: BeforeInstallPromptEvent | null; installed: boolean };

// The browser fires beforeinstallprompt once, early; keep it outside React so
// a layout that mounts later can still use it.
let state: InstallState = { prompt: null, installed: false };
const listeners = new Set<() => void>();
const emit = (next: Partial<InstallState>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    emit({ prompt: event as BeforeInstallPromptEvent });
  });
  window.addEventListener("appinstalled", () => emit({ prompt: null, installed: true }));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const SERVER_STATE: InstallState = { prompt: null, installed: true };

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * "Install app": uses the browser's install prompt where there is one
 * (Android, desktop Chrome/Edge) and shows the Share → Add to Home Screen
 * steps on iPhone. Hidden when the app is already installed.
 */
export function InstallAppButton() {
  const t = useTranslations("install");
  const current = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  const [helpOpen, setHelpOpen] = useState(false);
  const env = useSyncExternalStore(
    subscribe,
    () => (isStandalone() ? "standalone" : isIos() ? "ios" : "other"),
    () => "standalone",
  );

  if (current.installed || env === "standalone") return null;
  if (!current.prompt && env !== "ios") return null;

  async function install() {
    if (!current.prompt) return setHelpOpen(true);
    try {
      await current.prompt.prompt();
      const choice = await current.prompt.userChoice;
      emit({ prompt: null, installed: choice.outcome === "accepted" });
    } catch {
      // The prompt can only be used once; fall back to the manual steps.
      emit({ prompt: null });
      setHelpOpen(true);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={install} aria-label={t("button")} title={t("button")}>
        <DownloadIcon />
        <span className="hidden sm:inline">{t("button")}</span>
      </Button>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("iosTitle")}</DialogTitle>
            <DialogDescription>{t("iosBody")}</DialogDescription>
          </DialogHeader>
          <ol className="flex flex-col gap-3 text-sm">
            <li className="flex items-center gap-3">
              <ShareIcon className="size-5 shrink-0 text-primary" />
              {t("iosStep1")}
            </li>
            <li className="flex items-center gap-3">
              <SquarePlusIcon className="size-5 shrink-0 text-primary" />
              {t("iosStep2")}
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
