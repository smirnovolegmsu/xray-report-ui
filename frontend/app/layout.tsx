import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1117' },
  ],
};

export const metadata: Metadata = {
  title: "Xray Admin Panel",
  description: "Web panel for Xray VPN management",
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Xray Admin',
  },
};

// Inline crypto polyfill - MUST execute before any other code
const cryptoPolyfillScript = `
(function() {
  'use strict';
  if (typeof window === 'undefined') return;
  
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  if (!window.crypto) window.crypto = {};
  if (!window.crypto.randomUUID || typeof window.crypto.randomUUID !== 'function') {
    try {
      Object.defineProperty(window.crypto, 'randomUUID', {
        value: generateUUID,
        writable: true,
        configurable: true,
        enumerable: false,
      });
    } catch (e) {
      try { window.crypto.randomUUID = generateUUID; } catch(e2) {}
    }
  }
  
  if (typeof globalThis !== 'undefined') {
    if (!globalThis.crypto) globalThis.crypto = {};
    if (!globalThis.crypto.randomUUID || typeof globalThis.crypto.randomUUID !== 'function') {
      try {
        Object.defineProperty(globalThis.crypto, 'randomUUID', {
          value: generateUUID,
          writable: true,
          configurable: true,
          enumerable: false,
        });
      } catch (e) {
        try { globalThis.crypto.randomUUID = generateUUID; } catch(e2) {}
      }
    }
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Load crypto polyfill FIRST with beforeInteractive strategy */}
        <Script
          id="crypto-polyfill-inline"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: cryptoPolyfillScript }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
