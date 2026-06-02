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
    "74 technical-debt literature reviews cite, on average, 7.9% of the most-cited papers in the field they review. Audit plus data.",
  openGraph: {
    title: "slr.audit",
    description:
      "74 reviews, 50 canonical papers, year-matched. Half the field cites less than 2%. 36 cite zero.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "slr.audit",
    description:
      "74 reviews, 50 canonical papers, year-matched. Half the field cites less than 2%. 36 cite zero.",
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
