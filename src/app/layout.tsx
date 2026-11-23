import type { Metadata } from "next";
import { Inter, Noto_Sans_Georgian } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-inter",
  display: "swap"
});

const notoSansGeorgian = Noto_Sans_Georgian({
  subsets: ["georgian", "latin"],
  variable: "--font-noto-sans-georgian",
  display: "swap"
});

export const metadata: Metadata = {
  title: "World Market — ქართული ონლაინ მარკეტპლეისი",
  description: "World Market-ზე აღმოაჩინე, იყიდე და გაყიდე შენთვის საყვარელი ნივთები."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ka">
      <body className={`${inter.variable} ${notoSansGeorgian.variable}`}><I18nProvider>{children}</I18nProvider></body>
    </html>
  );
}
