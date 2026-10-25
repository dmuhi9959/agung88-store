import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegister } from "@/components/sw-register";

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
  manifest: "/manifest.json",
  applicationName: "STB Mod Store",
  appleWebApp: {
    capable: true,
    title: "STB Mod Store",
    statusBarStyle: "black-translucent",
    startupImage: [
      "/icons/splash-1920x1080.png",
    ],
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-72x72.png", sizes: "72x72", type: "image/png" },
      { url: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/icon-128x128.png", sizes: "128x128", type: "image/png" },
      { url: "/icons/icon-144x144.png", sizes: "144x144", type: "image/png" },
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-256x256.png", sizes: "256x256", type: "image/png" },
      { url: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/icons/favicon.ico"],
    other: [
      {
        rel: "mask-icon",
        url: "/icons/icon-monochrome-512.png",
      },
    ],
  },
  openGraph: {
    type: "website",
    title: "STB Mod Store - Toko Mod Set-Top Box",
    description: "Store mod STB (Set-Top Box) terlengkap untuk Indonesia",
    siteName: "STB Mod Store",
    images: [{ url: "/icons/icon-512x512.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "STB Mod Store",
    description: "Store mod STB (Set-Top Box) terlengkap untuk Indonesia",
    images: ["/icons/icon-512x512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#10b981" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="STB Mod Store" />
        <meta name="application-name" content="STB Mod Store" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-TileColor" content="#10b981" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
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
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
