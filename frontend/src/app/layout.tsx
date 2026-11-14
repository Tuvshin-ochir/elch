import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "cyrillic"] });

const DESCRIPTION =
  "Элч бол Facebook Messenger, Instagram болон вэбсайтад 24/7 хүн шиг хариулдаг AI туслах. Захиалга бүртгэж, хэрэглэгчээ tag-лаад, цагт нь мессеж илгээнэ. QPay болон картаар төлнө.";

export const metadata: Metadata = {
  // absolute URLs for the Facebook / Messenger link preview image
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100"),
  title: `${BRAND.name} — Хэрэглэгч бүрт шууд, найрсаг хариу`,
  description: DESCRIPTION,
  applicationName: BRAND.name,
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    locale: "mn_MN",
    title: `${BRAND.name} — Хэрэглэгч бүрт шууд, найрсаг хариу`,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
  appleWebApp: { title: BRAND.name, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#12805a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="mn" className={`${inter.variable} h-full`}>
      <body className="min-h-full font-sans">
        <I18nProvider>
          <AuthProvider>{children}</AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
