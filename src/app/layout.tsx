import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "AGUNG88 APP STORE - Download APK",
  description: "AGUNG88 APP STORE - Download APK untuk STB/Android TV.",
  applicationName: "AGUNG88 APP STORE",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// === CRITICAL INLINE CSS ===
// CSS ini DILANGSUNGKAN di HTML supaya tampil di STB walau CSS external tidak load
// WebView Android 6 kadang tidak load CSS dari URL dengan karakter khusus (%5B%5D)
const criticalCSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { 
    background: #0f172a; color: #e2e8f0; 
    font-family: sans-serif; 
    min-height: 100vh; 
    overflow-x: hidden;
  }
  img { max-width: 100%; height: auto; }
  .h-screen { height: 100vh; }
  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .flex-1 { flex: 1; }
  .overflow-hidden { overflow: hidden; }
  .overflow-y-auto { overflow-y: auto; }
  .shrink-0 { flex-shrink: 0; }
  .items-center { align-items: center; }
  .justify-center { justify-content: center; }
  .gap-2 { gap: 8px; }
  .gap-3 { gap: 12px; }
  .px-3 { padding-left: 12px; padding-right: 12px; }
  .px-5 { padding-left: 20px; padding-right: 20px; }
  .py-2 { padding-top: 8px; padding-bottom: 8px; }
  .py-4 { padding-top: 16px; padding-bottom: 16px; }
  .p-2 { padding: 8px; }
  .p-3 { padding: 12px; }
  .mb-3 { margin-bottom: 12px; }
  .mb-4 { margin-bottom: 16px; }
  .mt-4 { margin-top: 16px; }
  .text-center { text-align: center; }
  .text-xs { font-size: 12px; }
  .text-sm { font-size: 14px; }
  .font-bold { font-weight: bold; }
  .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rounded-lg { border-radius: 8px; }
  .border-b { border-bottom: 1px solid #334155; }
  .grid { display: grid; }
  .hidden { display: none; }
`;

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
        {/* Inline critical CSS - langsung di HTML, tidak butuh external file */}
        <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />
      </head>
      <body
        className="antialiased min-h-screen"
        style={{ background: '#0f172a', color: '#e2e8f0', fontFamily: 'sans-serif' }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <SonnerToaster
            position="top-center"
            richColors
            closeButton
            theme="dark"
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
