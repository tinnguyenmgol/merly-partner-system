"use client";
import Script from "next/script";
import { usePathname } from "next/navigation";
import type { AnalyticsSettings } from "@/features/analytics-settings";
export function GoogleAnalytics({ settings }: { settings: AnalyticsSettings }) {
  const pathname = usePathname() || "/";
  if (!settings.googleAnalyticsEnabled || !settings.googleAnalyticsMeasurementId) return null;
  const isAdmin = pathname.startsWith("/admin");
  const isPartner = pathname.startsWith("/dashboard");
  const shouldTrack = isAdmin ? settings.trackAdminPages : isPartner ? settings.trackPartnerPages : settings.trackPublicPages;
  if (!shouldTrack) return null;
  const id = settings.googleAnalyticsMeasurementId;
  return <><Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`} strategy="afterInteractive" /><Script id="merly-ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}',{page_path:window.location.pathname});`}</Script></>;
}
