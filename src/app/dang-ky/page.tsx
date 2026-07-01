import { MerlyLogo } from "@/components/merly-logo";
import { submitPartnerRegistration } from "@/features/partners/intake";

const fields = [
  ["fullName", "Họ và tên", true],
  ["phone", "Số điện thoại", true],
  ["email", "Email", false],
  ["zalo", "Zalo", false],
  ["area", "Khu vực / tỉnh thành", false],
  ["sellingChannel", "Kênh bán hàng", false],
  ["socialLink", "Link Facebook/TikTok/Shopee (nếu có)", false],
  ["bankAccountHolder", "Chủ tài khoản ngân hàng", false],
  ["bankName", "Tên ngân hàng", false],
  ["bankAccountNumber", "Số tài khoản ngân hàng", false],
] as const;

export default async function Register({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <MerlyLogo variant="auth" />
      <div className="card mt-8">
        <h1 className="text-3xl font-bold text-merly-900">Đăng ký CTV Merly</h1>
        <p className="mt-2 text-stone-600">
          Gửi hồ sơ đối tác referral_ctv. Admin Merly sẽ xét duyệt, tạo mã giới thiệu và kích hoạt tài khoản sau khi hồ sơ hợp lệ.
        </p>
        {status === "success" && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            Merly đã nhận đăng ký của bạn. Hồ sơ đang ở trạng thái chờ duyệt.
          </div>
        )}
        {status === "missing-required" && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
            Vui lòng nhập họ tên, số điện thoại và đồng ý chính sách trước khi gửi.
          </div>
        )}
        <form action={submitPartnerRegistration} className="mt-6 grid gap-4 md:grid-cols-2">
          {fields.map(([name, label, required]) => (
            <label className="grid gap-2 text-sm" key={name}>
              {label}
              <input className="input" name={name} placeholder={label} required={required} />
            </label>
          ))}
          <label className="grid gap-2 text-sm md:col-span-2">
            Kinh nghiệm / ghi chú
            <textarea className="input min-h-28" name="experienceNote" />
          </label>
          <label className="flex gap-3 text-sm md:col-span-2">
            <input name="acceptedPolicy" required type="checkbox" /> Tôi đồng ý chính sách CTV Merly và quy định đối soát hoa hồng.
          </label>
          <button className="btn-primary md:col-span-2" type="submit">
            Gửi đăng ký
          </button>
        </form>
      </div>
    </main>
  );
}
