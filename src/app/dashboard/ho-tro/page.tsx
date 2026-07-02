import Link from "next/link";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePartnerSession } from "@/features/auth/partner-auth";
import { getCtvProgramSettings } from "@/features/settings";

export const dynamic = "force-dynamic";

const faqs = [
  ["Cách lấy link giới thiệu", "Vào trang Mã giới thiệu để sao chép mã hoặc link giới thiệu cá nhân. Chị gửi link cho khách trước khi khách đặt hàng để Merly ghi nhận nguồn giới thiệu."],
  ["Cách gửi yêu cầu gắn đơn", "Nếu khách đã đặt nhưng đơn chưa hiện trong dashboard, chị vào Yêu cầu gắn đơn, nhập mã đơn hoặc thông tin khách để Merly kiểm tra và gắn đúng đối tác."],
  ["Khi nào đơn được tính hoa hồng", "Đơn được tính khi thuộc đúng nguồn giới thiệu của chị, khách nhận hàng thành công, doanh thu sản phẩm hợp lệ được xác nhận và không vi phạm chính sách giảm giá."],
  ["Vì sao đơn bị loại khỏi hoa hồng", "Đơn hủy, hoàn, khách không nhận, trùng nguồn giới thiệu, tự ý giảm giá ngoài chính sách hoặc không đủ dữ liệu xác minh sẽ không được tính hoa hồng."],
  ["Khi nào được thanh toán", "Hoa hồng được đối soát theo kỳ thanh toán của Merly. Khi số dư đạt mức tối thiểu và không còn chờ đối soát, Merly sẽ tạo thanh toán cho chị."],
  ["Cập nhật thông tin ngân hàng như thế nào", "Chị có thể cập nhật thông tin ngân hàng trong trang Tài khoản trước lần thanh toán đầu tiên. Sau khi đã có thanh toán đầu tiên, thông tin nhận tiền sẽ khóa và cần Merly xác minh để đổi."],
];

export default async function Page() {
  await requirePartnerSession();
  const settings = await getCtvProgramSettings();
  return (
    <DashboardShell>
      <div className="grid gap-6">
        <div className="card">
          <h1 className="text-3xl font-bold text-merly-900">Hỗ trợ CTV</h1>
          <p className="mt-3 text-stone-600">Merly hỗ trợ chị trong quá trình lấy link, gắn đơn, đối soát hoa hồng và cập nhật thông tin thanh toán.</p>
          <div className="mt-4 rounded-2xl bg-rose-50 p-4">
            <p className="text-sm text-stone-500">Zalo/SĐT hỗ trợ</p>
            <p className="text-2xl font-bold text-merly-900">{settings.supportPhoneOrZalo || "Zalo/SĐT Merly"}</p>
            <p className="mt-2 text-sm text-stone-600">Khi liên hệ, chị vui lòng gửi mã CTV, mã đơn hoặc ảnh chụp thông tin cần kiểm tra để Merly xử lý nhanh hơn.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="btn-primary px-4 py-2" href="/dashboard/ma-gioi-thieu">Xem mã giới thiệu</Link>
            <Link className="btn-secondary px-4 py-2" href="/dashboard/yeu-cau-gan-don">Gửi yêu cầu gắn đơn</Link>
            <Link className="btn-secondary px-4 py-2" href="/dashboard/tai-khoan">Cập nhật tài khoản</Link>
          </div>
        </div>

        <div className="card">
          <h2 className="text-2xl font-bold text-merly-900">Câu hỏi thường gặp</h2>
          <div className="mt-4 grid gap-3">
            {faqs.map(([title, body]) => (
              <details className="rounded-2xl border border-rose-100 p-4" key={title} open={title === "Cách lấy link giới thiệu"}>
                <summary className="cursor-pointer font-semibold text-merly-900">{title}</summary>
                <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
