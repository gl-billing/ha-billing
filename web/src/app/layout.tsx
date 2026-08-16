import type { Metadata } from "next";
import { Oswald, Inter } from "next/font/google";
import { cookies, headers } from "next/headers";
import { getSafeServerSession } from "@/lib/safe-server-session";
import { Providers } from "@/components/Providers";
import { isNextAuthSecretConfigured } from "@/lib/auth-env";
import {
  LAYOUT_MODE_COOKIE,
  LEGACY_LAYOUT_MODE_COOKIE,
  isPhoneUserAgent,
  parseLayoutModeCookie,
  shouldOpenNativeMobileHome
} from "@/lib/layout-mode-prefs";
import "./globals.css";
import "./ui-premium.css";
import "./ha-theme.css";
import "./ha-clio-shell.css";
import "./ha-space-shell.css";
import "./office-hub.css";
import "./tables-mobile.css";
import "./print.css";
import "./viewport-shell.css";
import "./letterhead-polish.css";
import "./ha-visual-polish.css";
import "./ha-fullbleed.css";
import "./templates-library.css";
import "./mobile-polish.css";
import "./mobile-office.css";
import "./mobile-theme.css";
import "./mobile-foundation.css";
import "./mobile-matter.css";
import "./mobile-documents.css";
import "./mobile-staff.css";
import "./mobile-reports.css";
import "./mobile-tasks.css";
import "./mobile-screens.css";
import "./mobile-walkins.css";
import "./mobile-intake.css";
/* Last CSS wins for phone/iPhone overrides — keep after fullbleed */
import "./mobile-iphone.css";
/* Last-loaded HA responsive + brand isolation — must win over phone and theme layers */
import "./ha-responsive.css";

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
    { media: "(prefers-color-scheme: light)", color: "#f0f0f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" }
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover" as const
};

const buildLabel =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  process.env.NEXT_PUBLIC_BUILD_LABEL ||
  "dev";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = isNextAuthSecretConfigured() ? await getSafeServerSession() : null;
  const cookieStore = await cookies();
  const headerList = await headers();
  const layoutCookie = cookieStore.get(LAYOUT_MODE_COOKIE)?.value || cookieStore.get(LEGACY_LAYOUT_MODE_COOKIE)?.value;
  const serverLayoutMode = parseLayoutModeCookie(layoutCookie);
  const userAgent = headerList.get("user-agent");
  const serverPhone = isPhoneUserAgent(userAgent);
  const serverNativeMobile = shouldOpenNativeMobileHome({
    layoutCookie,
    userAgent
  });

  return (
    <html
      lang="en"
      {...(serverPhone ? { "data-phone-viewport": "true" } : {})}
      {...(serverNativeMobile ? { "data-layout-mode": "mobile" } : {})}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var q=null;try{q=new URLSearchParams(location.search).get("ha-layout");}catch(e){}var ua=navigator.userAgent||"";var phone=/iPhone|iPod|Android.+Mobile|Windows Phone|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);if(/Android/i.test(ua)&&!/Mobile/i.test(ua))phone=false;if(/iPad|Tablet|PlayBook/i.test(ua)&&!/Mobile/i.test(ua))phone=false;try{if(navigator.userAgentData&&navigator.userAgentData.mobile)phone=true;}catch(e){}if(!phone){try{if(window.matchMedia("(max-width: 767px)").matches)phone=true;}catch(e){}}if(!phone&&window.innerWidth&&window.innerWidth<=767)phone=true;if(!phone&&window.screen&&window.screen.width&&window.screen.width<=767)phone=true;if(q==="mobile")phone=true;d.setAttribute("data-phone-viewport",phone?"true":"false");if(!phone){d.setAttribute("data-layout-mode","desktop");return;}if(q==="mobile"){d.setAttribute("data-layout-mode","mobile");try{localStorage.setItem("ha-office-layout-mode","mobile");}catch(e){}try{document.cookie="ha-office-layout-mode=mobile; Path=/; Max-Age=31536000; SameSite=Lax";}catch(e){}return;}if(q==="desktop"){d.setAttribute("data-layout-mode","desktop");try{localStorage.setItem("ha-office-layout-mode","desktop");}catch(e){}try{document.cookie="ha-office-layout-mode=desktop; Path=/; Max-Age=31536000; SameSite=Lax";}catch(e){}return;}var m=null;try{m=localStorage.getItem("ha-office-layout-mode")||localStorage.getItem("gl-office-layout-mode");}catch(e){}if(m!=="desktop"&&m!=="mobile")m="mobile";d.setAttribute("data-layout-mode",m);try{document.cookie="ha-office-layout-mode="+encodeURIComponent(m)+"; Path=/; Max-Age=31536000; SameSite=Lax";}catch(e){}}catch(e){}})();`
          }}
        />
      </head>
      <body className={`${uiSans.variable} ${displayOswald.variable} font-sans antialiased`}>
        <Providers session={session} serverLayoutMode={serverLayoutMode}>
          {children}
        </Providers>
        <span className="sr-only" data-ha-build={buildLabel}>
          Hernandez & Associates build {buildLabel}
        </span>
      </body>
    </html>
  );
}
