import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Designsystem "Værksted": kun disse to skrifter må bruges. Se CLAUDE.md.
const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "NettoText",
  description: "Danske webtekster, du selv godkender.",
};

// V1 er kun dansk, så lang står fast her. Når /en tilføjes, flyttes
// <html> ned i app/[locale]/layout.tsx, så lang følger sproget.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="da"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bund text-gran">
        {children}
      </body>
    </html>
  );
}
