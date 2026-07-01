import { DashboardShell } from "@/components/layout/dashboard-shell";
import { runHaravanOrderSync } from "@/features/haravan/actions";
import { HaravanClient } from "@/features/haravan/haravan-client";
import { db, getDatabaseErrorMessage, hasDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Haravan() {
  const clientStatus = await new HaravanClient().healthCheck();
  let logsWarning: string | null = null;
  const latestLogs = [];

  if (hasDatabaseUrl()) {
    try {
      latestLogs.push(
        ...(await db.haravanSyncLog.findMany({
          select: { id: true, syncType: true, status: true, message: true, startedAt: true, finishedAt: true },
          orderBy: { startedAt: "desc" },
          take: 20,
        })),
      );
    } catch (error) {
      console.error("Failed to load Haravan sync logs", error);
      logsWarning = getDatabaseErrorMessage(error, "Không thể tải Haravan sync log. Vui lòng thử lại sau.");
    }
  }

  const latestLog = latestLogs[0];

  return (
    <DashboardShell admin>
      <div className="card">
        <h1 className="text-3xl font-bold text-merly-900">Cài đặt Haravan</h1>
        <p className="mt-3 text-stone-600">
          Đồng bộ thủ công đơn hàng Haravan và gán đối tác referral_ctv bằng mã giảm giá. Webhook, commission engine và payout engine chưa được triển khai trong bước này.
        </p>
        {logsWarning ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{logsWarning}</p> : null}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-rose-50/60 p-4">
            <p className="text-sm text-stone-500">API connection status</p>
            <p className="mt-1 font-semibold text-merly-900">{clientStatus.ok ? "Đã cấu hình" : clientStatus.message}</p>
          </div>
          <div className="rounded-xl bg-rose-50/60 p-4">
            <p className="text-sm text-stone-500">Last sync result</p>
            <p className="mt-1 font-semibold text-merly-900">{latestLog ? `${latestLog.status}: ${latestLog.message ?? "Không có thông điệp"}` : "Chưa có sync"}</p>
          </div>
          <div className="rounded-xl bg-rose-50/60 p-4">
            <p className="text-sm text-stone-500">Last sync time</p>
            <p className="mt-1 font-semibold text-merly-900">{latestLog?.finishedAt?.toLocaleString("vi-VN") ?? latestLog?.startedAt.toLocaleString("vi-VN") ?? "—"}</p>
          </div>
          <form action={runHaravanOrderSync} className="rounded-xl border border-rose-100 p-4">
            <p className="text-sm text-stone-500">Manual order sync</p>
            <button className="btn-primary mt-3" type="submit" disabled={!clientStatus.ok || !hasDatabaseUrl()}>
              Chạy sync đơn hàng
            </button>
          </form>
        </div>
      </div>
      <div className="card mt-6">
        <h2 className="text-xl font-bold text-merly-900">Sync logs</h2>
        <div className="mt-4 grid gap-3">
          {latestLogs.map((log) => (
            <div className="rounded-xl border border-rose-100 p-4" key={log.id}>
              <b>{log.syncType} · {log.status}</b>
              <p className="text-sm text-stone-500">{log.startedAt.toLocaleString("vi-VN")} · {log.message ?? "Không có thông điệp"}</p>
            </div>
          ))}
          {latestLogs.length === 0 && <p className="text-sm text-stone-500">Chưa có Haravan sync log.</p>}
        </div>
      </div>
    </DashboardShell>
  );
}
