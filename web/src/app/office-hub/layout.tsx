import type { Viewport } from "next";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" }
  ]
};

export default function OfficeHubLayout({ children }: { children: React.ReactNode }) {
  return <div className="office-hub-page">{children}</div>;
}
