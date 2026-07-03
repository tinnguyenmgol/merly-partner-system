"use client";

import { useCallback, useEffect, useState } from "react";

const STALE_BUILD_MESSAGE = "Hệ thống vừa được cập nhật. Vui lòng tải lại trang trước khi tiếp tục.";
const STALE_ACTION_MESSAGE = "Phiên làm việc đã cũ sau khi hệ thống cập nhật. Vui lòng tải lại trang rồi thử lại.";

function looksLikeServerActionMismatch(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason ?? "");
  return (
    message.includes("Failed to find Server Action") ||
    message.includes("older or newer deployment") ||
    /Server Action/i.test(message) && /deployment/i.test(message)
  );
}

export function BuildVersionWatcher({ buildVersion }: { buildVersion: string }) {
  const [message, setMessage] = useState("");

  const checkBuildVersion = useCallback(async () => {
    try {
      const response = await fetch(`/api/build-version?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { buildVersion?: string };
      if (data.buildVersion && data.buildVersion !== buildVersion) setMessage(STALE_BUILD_MESSAGE);
    } catch {
      // Network hiccups should not interrupt the current session.
    }
  }, [buildVersion]);

  useEffect(() => {
    const interval = window.setInterval(checkBuildVersion, 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkBuildVersion();
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (looksLikeServerActionMismatch(event.reason)) setMessage(STALE_ACTION_MESSAGE);
    };
    const onError = (event: ErrorEvent) => {
      if (looksLikeServerActionMismatch(event.error ?? event.message)) setMessage(STALE_ACTION_MESSAGE);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onError);
    const initialCheck = window.setTimeout(() => void checkBuildVersion(), 0);

    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onError);
    };
  }, [checkBuildVersion]);

  if (!message) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-lg md:inset-x-auto md:right-4 md:max-w-md" role="alert">
      <p className="text-sm font-semibold">{message}</p>
      <button className="mt-3 rounded-full bg-amber-900 px-4 py-2 text-sm font-bold text-white hover:bg-amber-800" onClick={() => window.location.reload()} type="button">
        Tải lại trang
      </button>
    </div>
  );
}
