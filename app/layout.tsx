import type { Metadata } from "next";
import { hanken, spectral, naskh, amiri } from "@/lib/fonts";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maqra — read Arabic, beautifully",
  description:
    "Read real Arabic books in-app, tap any word to translate, and build a vocabulary that sticks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${hanken.variable} ${spectral.variable} ${naskh.variable} ${amiri.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
