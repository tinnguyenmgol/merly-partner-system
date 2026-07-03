import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import {
  MINIMUM_PAYOUT_AMOUNT_VND,
  getCtvMonthlyTier,
  getCtvTierLabel,
  isCtvOrderValidForMonthlyTier,
  summarizeLedgers,
  summarizeOrders,
} from "@/features/commissions";
import { formatVnd } from "@/lib/money";
import { getCtvProgramSettings } from "@/features/settings";
import { getPartnerChallenges } from "@/features/challenges";
import { partnerRecruitmentLink } from "@/features/referral-link";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await requirePartnerSession();
  const partner = session.account.partner;
  const { db } = await import("@/lib/db");
  const orders = await db.partnerOrder.findMany({
    where: { partnerId: partner.id },
    include: { ledgerEntries: { include: { order: true } } },
  });
  const ledgerSummary = summarizeLedgers(
    orders.flatMap((order) => order.ledgerEntries),
  );
  const orderSummary = summarizeOrders(orders);
  const code = partner.codes[0]?.code ?? "—";
  const settings = await getCtvProgramSettings();
  const nowForActions = new Date();
  const [unreadAnnouncements, activeContentCount, activeCampaign, pendingOrderRequests, challengeItems, trainingLessons, referralRows] = await Promise.all([
    db.partnerAnnouncement.findMany({
      where: { targetPartnerType: partner.partnerType.code, archivedAt: null, publishAt: { lte: nowForActions }, OR: [{ expiresAt: null }, { expiresAt: { gt: nowForActions } }], reads: { none: { partnerId: partner.id } } },
      orderBy: [{ pinned: "desc" }, { priority: "desc" }, { publishAt: "desc" }],
      take: 3,
    }),
    db.partnerContentAsset.count({ where: { status: "published", publishAt: { lte: nowForActions }, OR: [{ expiresAt: null }, { expiresAt: { gt: nowForActions } }] } }),
    db.partnerCampaign.findFirst({ where: { status: "published", startAt: { lte: nowForActions }, OR: [{ endAt: null }, { endAt: { gt: nowForActions } }] }, orderBy: [{ priority: "desc" }, { startAt: "asc" }] }),
    db.partnerOrderRequest.count({ where: { partnerId: partner.id, status: "pending" } }),
    getPartnerChallenges(partner.id),
    db.partnerTrainingLesson.findMany({ where: { status: "published", archivedAt: null, publishAt: { lte: nowForActions } }, include: { progress: { where: { partnerId: partner.id } } }, orderBy: [{ orderIndex: "asc" }, { publishAt: "desc" }] }),
    db.partnerReferral.findMany({ where: { referrerPartnerId: partner.id } }),
  ]);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const monthlyValidOrders = orders.filter((order) => order.createdAt >= monthStart && order.createdAt < nextMonth && isCtvOrderValidForMonthlyTier(order)).length;
  const currentTier = getCtvMonthlyTier(monthlyValidOrders, settings.ctvNoStockCommissionPolicy.monthlyTierThresholds);
  const tier10 = settings.ctvNoStockCommissionPolicy.monthlyTierThresholds.find((t) => t.key === "tier_10")!.minValidOrders;
  const tier30 = settings.ctvNoStockCommissionPolicy.monthlyTierThresholds.find((t) => t.key === "tier_30")!.minValidOrders;
  const nextThreshold = monthlyValidOrders < tier10 ? tier10 : monthlyValidOrders < tier30 ? tier30 : null;
  const progressMessage = nextThreshold ? `Tháng này chị có ${monthlyValidOrders} đơn hợp lệ. Còn ${nextThreshold - monthlyValidOrders} đơn nữa để đạt mốc hoa hồng từ ${nextThreshold} đơn/tháng.` : `Chị đang ở mốc cao nhất từ ${tier30} đơn/tháng.`;

  const missingPaymentInfo = !partner.profile?.bankName || !partner.profile.bankAccountNumber || !partner.profile.bankAccountHolder;
  const nearestChallenge = challengeItems.filter((item) => item.progress.status === "in_progress").sort((a, b) => (a.progress.targetValue - a.progress.currentValue) - (b.progress.targetValue - b.progress.currentValue))[0];
  const completedLessonCount = trainingLessons.filter((lesson) => lesson.progress[0]?.status === "completed").length;
  const nextLesson = trainingLessons.find((lesson) => lesson.progress[0]?.status !== "completed");
  const pendingReferralRewards = referralRows.filter((row) => row.status === "reward_pending").length;
  const partnerReferralCode = partner.codes[0]?.code ?? partner.id;
  const actionCards = [
    ...(missingPaymentInfo ? [{ title: "Cập nhật thông tin thanh toán", body: "Chị chưa cập nhật đủ thông tin nhận thanh toán.", href: "/dashboard/tai-khoan", cta: "Cập nhật tài khoản" }] : []),
    ...(unreadAnnouncements.length ? [{ title: "Thông báo mới từ Merly", body: `Chị có ${unreadAnnouncements.length} thông báo mới từ Merly.`, href: "/dashboard/thong-bao", cta: "Xem thông báo" }] : []),
    ...(activeCampaign ? [{ title: "Chương trình đang chạy", body: `Đang có chương trình: ${activeCampaign.title}`, href: "/dashboard/lich-chuong-trinh", cta: "Xem lịch chương trình" }] : []),
    ...(activeContentCount ? [{ title: "Đăng nội dung mới", body: `Có ${activeContentCount} nội dung mới để chị đăng hôm nay.`, href: "/dashboard/kho-noi-dung", cta: "Xem kho nội dung" }] : []),
    { title: "Tiến độ cấp bậc", body: nextThreshold ? `Còn ${nextThreshold - monthlyValidOrders} đơn nữa để lên mốc hoa hồng tiếp theo.` : "Chị đang ở mốc hoa hồng cao nhất tháng này.", href: "/dashboard/cap-bac", cta: "Xem cấp bậc" },
    ...(nearestChallenge ? [{ title: "Thử thách gần hoàn thành", body: `Còn ${Math.max(nearestChallenge.progress.targetValue - nearestChallenge.progress.currentValue, 0)} đơn/doanh thu hợp lệ nữa để hoàn thành thử thách ${nearestChallenge.challenge.title}.`, href: "/dashboard/thu-thach", cta: "Xem thử thách" }] : []),
    ...(nextLesson ? [{ title: `Bài học tiếp theo: ${nextLesson.title}`, body: `${completedLessonCount}/${trainingLessons.length} bài đã hoàn thành.`, href: `/dashboard/dao-tao/${nextLesson.id}`, cta: "Học ngay" }] : []),
    ...(referralRows.length === 0 ? [{ title: "Giới thiệu partner mới", body: `Chia sẻ link ${partnerRecruitmentLink(partnerReferralCode)} để Merly biết ai do chị giới thiệu.`, href: "/dashboard/gioi-thieu-partner", cta: "Copy link giới thiệu" }] : []),
    { title: "Bảng xếp hạng", body: "Xem CTV đang dẫn đầu tuần này.", href: "/dashboard/bang-xep-hang", cta: "Xem bảng xếp hạng" },
    ...(pendingOrderRequests ? [{ title: "Yêu cầu gắn đơn", body: `Có ${pendingOrderRequests} yêu cầu gắn đơn đang chờ Merly xử lý.`, href: "/dashboard/yeu-cau-gan-don", cta: "Xem yêu cầu gắn đơn" }] : []),
  ].slice(0, 6);

  return (
    <DashboardShell>
      <h1 className="text-3xl font-bold text-merly-900">
        Tổng quan {partner.displayName}
      </h1>
      <p className="mt-2 text-stone-600">
        Mã đối tác {code} · https://merlyshoes.com/?ref={code}
      </p>
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold text-merly-900">Việc nên làm hôm nay</h2><p className="text-sm text-stone-600">Các bước ưu tiên để chị có thêm đơn hôm nay.</p></div></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{actionCards.map((action) => <a key={action.href + action.title} className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 hover:bg-rose-50" href={action.href}><h3 className="font-bold text-merly-900">{action.title}</h3><p className="mt-2 text-sm text-stone-700">{action.body}</p><span className="mt-3 inline-block text-sm font-semibold text-merly-700">{action.cta} →</span></a>)}</div>
      </section>
      <div className="mt-6 grid gap-4 md:grid-cols-5">
        <div className="card">
          <p>Tổng đơn ghi nhận</p>
          <b>{orderSummary.totalAttributedOrders}</b>
        </div>
        <div className="card">
          <p>Đơn hợp lệ</p>
          <b>{orderSummary.eligibleOrders}</b>
        </div>
        <div className="card">
          <p>Doanh thu hợp lệ</p>
          <b>{formatVnd(orderSummary.eligibleRevenue)}</b>
        </div>
        <div className="card">
          <p>Hoa hồng có thể trả</p>
          <b>{formatVnd(ledgerSummary.payable)}</b>
          <p className="text-sm text-stone-500">
            Tối thiểu {formatVnd(MINIMUM_PAYOUT_AMOUNT_VND)}
          </p>
        </div>
        <div className="card">
          <p>Đào tạo / giới thiệu</p>
          <b>{completedLessonCount}/{trainingLessons.length}</b>
          <p className="text-sm text-stone-500">{referralRows.length} partner giới thiệu · {pendingReferralRewards} thưởng chờ</p>
        </div>
      </div>
      <div className="card mt-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-rose-50 p-4">
          <div><h2 className="text-xl font-bold text-merly-900">Thông báo chưa đọc</h2><p className="text-sm text-stone-600">Cập nhật mới nhất từ Merly.</p></div>
          <a className="font-semibold text-merly-700" href="/dashboard/thong-bao">Xem tất cả</a>
          <div className="w-full space-y-2">{unreadAnnouncements.map((item) => <div key={item.id} className="rounded-xl bg-white p-3 text-sm"><b>{item.pinned ? "📌 " : ""}{item.title}</b><p className="line-clamp-2 text-stone-600">{item.body}</p></div>)}{unreadAnnouncements.length === 0 ? <p className="text-sm text-stone-500">Không có thông báo chưa đọc.</p> : null}</div>
        </div>
        <h2 className="text-2xl font-bold text-merly-900">Tiến độ hoa hồng tháng này</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4"><div><p>Đơn hợp lệ tháng này</p><b>{monthlyValidOrders}</b></div><div><p>Hạng hoa hồng hiện tại</p><b>{getCtvTierLabel(currentTier)}</b></div><div><p>Mốc tiếp theo</p><b>{nextThreshold ? `Từ ${nextThreshold} đơn/tháng` : "Mốc cao nhất"}</b></div><div><p>Còn thiếu</p><b>{nextThreshold ? `${nextThreshold - monthlyValidOrders} đơn` : "0 đơn"}</b></div></div>
        <p className="mt-4 rounded-xl bg-rose-50 p-3 text-merly-900">{currentTier === "tier_10" ? `Chị đang ở mốc từ ${tier10} đơn/tháng.` : progressMessage}</p>
        <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-stone-500"><tr><th>Loại đơn</th><th>Dưới {tier10} đơn/tháng</th><th>Từ {tier10} đơn/tháng</th><th>Từ {tier30} đơn/tháng</th></tr></thead><tbody>{settings.ctvNoStockCommissionPolicy.orderClasses.map((c) => <tr className="border-t border-stone-100" key={c.key}><td className="py-3">{c.label}</td><td>{c.ratesByTierBps.base / 100}%</td><td>{c.ratesByTierBps.tier_10 / 100}%</td><td>{c.ratesByTierBps.tier_30 / 100}%</td></tr>)}</tbody></table></div>
      </div>
    </DashboardShell>
  );
}
