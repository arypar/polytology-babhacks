import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = localFont({
  src: [
    {
      path: "../../public/fonts/Inter-Polymarket-VariableFont_opsz,wght.ttf",
      style: "normal",
    },
    {
      path: "../../public/fonts/Inter-Polymarket-Italic-VariableFont_opsz,wght.ttf",
      style: "italic",
    },
  ],
  variable: "--font-geist-sans",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Polytology",
  description: "Autonomous prediction market intelligence and trading",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${inter.variable} antialiased font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
