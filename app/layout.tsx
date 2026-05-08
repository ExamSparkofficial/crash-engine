import type { Metadata, Viewport } from "next";
import { Providers } from "@/app/providers";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "CrashPulse AI",
  description:
    "Realtime statistical analytics dashboard for Aviator and crash-style multiplier games.",
  applicationName: "CrashPulse AI"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050910"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
