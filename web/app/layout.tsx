import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CommandPaletteMount } from "@/components/command-palette-mount";
import { PageTransition } from "@/components/page-transition";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://web-e4qhnnknz-connor-tessaros-projects.vercel.app"),
  title: "slr.audit · citation coverage of technical-debt SLRs",
  description:
    "60 published technical-debt literature reviews compared against the 50 most-cited papers in the field. Half cite under 5% of them. 24 cite zero.",
  openGraph: {
    title: "slr.audit",
    description:
      "60 published reviews, 50 most-cited papers, year-matched. Half cite under 5%. 24 cite zero.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "slr.audit",
    description:
      "60 published reviews, 50 most-cited papers, year-matched. Half cite under 5%. 24 cite zero.",
  },
};

const themeInit = `
  try {
    var t = localStorage.getItem('slr-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  } catch (_) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
        <SiteHeader />
        <main className="flex-1 relative">
          <PageTransition>{children}</PageTransition>
        </main>
        <SiteFooter />
        <CommandPaletteMount />
      </body>
    </html>
  );
}
