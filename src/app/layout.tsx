import type { Metadata } from "next";
import { BuildVersionWatcher } from "@/components/build-version-watcher";
import { buildVersion } from "@/lib/build-version";
import "./globals.css";

export const metadata: Metadata = {
  title: "Merly Partner System",
  description: "Nền tảng đối tác Merly Shoes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        {children}
        <BuildVersionWatcher buildVersion={buildVersion} />
      </body>
    </html>
  );
}
