import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "راديو أ.د. على قطب الذكي — Prof Ali Kotb Smart Radio",
  description: "Private live radio",
  applicationName: "Smart Radio",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "راديو أ.د. على قطب", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08142a" },
    { media: "(prefers-color-scheme: light)", color: "#f5efe2" },
  ],
};

// Runs before paint: applies saved language/direction/theme/text size so there is no RTL↔LTR flash.
const boot = `try{var s=JSON.parse(localStorage.getItem("sr.state.v1")||"{}").settings||{};var d=document.documentElement;var l=s.lang==="en"?"en":"ar";d.lang=l;d.dir=l==="ar"?"rtl":"ltr";if(s.theme==="light"||s.theme==="dark")d.dataset.theme=s.theme;if(s.textScale)d.style.setProperty("--scale",String(s.textScale));}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@500;700&display=swap"
        />
      </head>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
