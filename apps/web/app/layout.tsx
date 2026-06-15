import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono"
});

export const metadata: Metadata = {
  title: "Zoe Espresso Observatory",
  description: "Caffeine-fueled Path of Exile 2 build intelligence"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jetBrainsMono.variable} dark`}>
      <body>{children}</body>
    </html>
  );
}
