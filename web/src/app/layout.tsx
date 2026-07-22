import type { Metadata } from "next";
import { Oswald, Inter } from "next/font/google";
import { getSafeServerSession } from "@/lib/safe-server-session";
import { Providers } from "@/components/Providers";
import { isNextAuthSecretConfigured } from "@/lib/auth-env";
import "./globals.css";
import "./ui-premium.css";
import "./ha-theme.css";
import "./ha-clio-shell.css";

const uiSans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap"
});

const displayOswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: "Hernandez & Associates",
    template: "%s · Hernandez & Associates"
  },
  description: "Hernandez & Associates — billing, tasks, and calendar",
  manifest: "/manifest.json",
  applicationName: "Hernandez & Associates",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    title: "Hernandez & Associates",
    statusBarStyle: "black-translucent"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" }
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const
};

const buildLabel =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  process.env.NEXT_PUBLIC_BUILD_LABEL ||
  "dev";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = isNextAuthSecretConfigured() ? await getSafeServerSession() : null;

  return (
    <html lang="en">
      <body className={`${uiSans.variable} ${displayOswald.variable} font-sans antialiased`}>
        <Providers session={session}>{children}</Providers>
        <span className="sr-only" data-ha-build={buildLabel}>
          Hernandez & Associates build {buildLabel}
        </span>
      </body>
    </html>
  );
}
