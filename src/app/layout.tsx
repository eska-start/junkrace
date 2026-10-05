import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../jr/index.css";

export const metadata: Metadata = {
  title: "고물 레이서즈 - Junk Racers",
  description: "15초 동안 고물을 모아 나만의 자동차를 만들고, 90초 페인트 배틀에서 가장 넓은 영역을 차지하세요.",
  applicationName: "고물레이서즈",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg?v=3", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png?v=3", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png?v=3", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png?v=3", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png?v=3", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "고물레이서즈",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#203e35",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="고물레이서즈" />
        <meta name="theme-color" content="#203e35" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png?v=3" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png?v=3" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=3" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__pwaPrompt = null;
              window.addEventListener('beforeinstallprompt', function(e) {
                e.preventDefault();
                window.__pwaPrompt = e;
                window.dispatchEvent(new CustomEvent('pwa-prompt-ready'));
              });
              window.addEventListener('appinstalled', function() {
                window.__pwaPrompt = null;
                window.dispatchEvent(new CustomEvent('pwa-installed'));
              });
              if ('serviceWorker' in navigator) {
                var reg = function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.warn('[PWA] SW register error:', err);
                  });
                };
                if (document.readyState === 'complete') {
                  reg();
                } else {
                  window.addEventListener('load', reg);
                }
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
