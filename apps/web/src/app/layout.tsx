import "@fynlo/ui/globals.css";

import type { Metadata, Viewport } from "next";

import { Inter } from "next/font/google";

import { FinanceProvider } from "@/providers/finance-provider";
import { ThemeProvider } from "@/providers/theme-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  description: "Fynlo, a personal finance tracker",
  icons: "/favicon.svg",
  title: "Fynlo",
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className={inter.variable} lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
          enableSystem={false}
          storageKey="fynlo-theme"
        >
          <FinanceProvider>{children}</FinanceProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
