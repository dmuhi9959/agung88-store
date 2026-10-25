import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "STB Mod Store - Toko Mod Set-Top Box Terlengkap",
  description:
    "Store mod STB (Set-Top Box) terlengkap. Download ROM, aplikasi, launcher, codec, dan mod lainnya untuk berbagai STB seperti B860H, IndiBox, Evictrio, Mi Box S.",
  keywords: [
    "STB mod",
    "set-top box",
    "B860H",
    "IndiBox",
    "Evictrio",
    "Mi Box",
    "Android TV mod",
    "IPTV",
    "ROM",
    "firmware",
  ],
  authors: [{ name: "STB Mod Store" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster
            position="top-right"
            richColors
            closeButton
            theme="system"
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
