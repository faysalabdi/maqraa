import type { Metadata } from "next";
import { hanken, spectral, naskh, amiri } from "@/lib/fonts";
import { env } from "@/lib/env";
import { Providers } from "./providers";
import "./globals.css";

const title = "Maqraa — get through real Arabic books";
const description =
  "Read real Arabic books in-app, tap any word to translate, and build a vocabulary that sticks.";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: title,
    template: "%s · Maqraa",
  },
  description,
  applicationName: "Maqraa",
  openGraph: {
    type: "website",
    siteName: "Maqraa",
    title,
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
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
