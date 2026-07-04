import type { Metadata } from "next";
import { BuildVersionWatcher } from "@/components/build-version-watcher";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { getAnalyticsSettings } from "@/features/analytics-settings";
import { buildVersion } from "@/lib/build-version";
import "./globals.css";

export const metadata: Metadata = {
  title: "Merly Partner System",
  description: "Nền tảng đối tác Merly Shoes",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const analyticsSettings = await getAnalyticsSettings();
  return (
    <html lang="vi">
      <body>
        {children}
        <GoogleAnalytics settings={analyticsSettings} />
        <BuildVersionWatcher buildVersion={buildVersion} />
      </body>
    </html>
  );
}
