import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Nastaliq_Urdu } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import { localeDirection } from "@/i18n/config";
import "./globals.css";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const urdu = Noto_Nastaliq_Urdu({
  variable: "--font-urdu",
  subsets: ["arabic"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: {
      default: t("common.appTitle"),
      template: `%s · ${t("common.programName")}`,
    },
    description: t("metadata.description"),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f6b4f",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dir = localeDirection(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${sans.variable} ${mono.variable} ${urdu.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <DirectionProvider dir={dir}>
            {children}
            <Toaster position="top-center" dir={dir} richColors />
          </DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
