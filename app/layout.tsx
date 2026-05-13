import type { Metadata } from "next";
import "./globals.css";

import { DM_Sans, JetBrains_Mono } from "next/font/google";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Kōdex — The Dojo",
  description: "Master the logic. Forge the intuition.",
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} min-h-full flex flex-col bg-kodex-bg text-kodex-text`}
      >
        {children}
      </body>
    </html>
  );
}
