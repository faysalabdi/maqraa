import type { Metadata } from "next";
import { inter, naskh, amiri } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "arabic-xp — read Arabic, level up",
  description:
    "Gamified Arabic reading tracker. Move from beginner books to classical scholars, with real comprehension verification.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${naskh.variable} ${amiri.variable}`}>
      <body>{children}</body>
    </html>
  );
}
